// SERVER-ONLY. Centralna logika publikacji posta na wybrane platformy.
// Używana zarówno przez `publishPostNow` (ręcznie z UI) jak i przez cron
// `social-publish-scheduled`. Dzięki temu obie ścieżki działają identycznie.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clearAccountError,
  getAdapter,
  getValidAccount,
  markAccountError,
} from "./platforms/index.server";
import type { PlatformPostContent } from "./platforms/types";

export type PerPlatformResult = {
  status: "success" | "error" | "skipped_no_account" | "skipped_no_adapter";
  externalPostId?: string | null;
  externalUrl?: string | null;
  errorMessage?: string | null;
};

export async function publishPostToAllPlatforms(args: {
  postId: string;
  organizationId: string;
}): Promise<Record<string, PerPlatformResult>> {
  const nowIso = new Date().toISOString();

  // 1) pobierz post
  const { data: postRow, error: postErr } = await supabaseAdmin
    .from("social_posts")
    .select("id, organization_id, target_platforms, content_per_platform, status")
    .eq("id", args.postId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();
  if (postErr) throw new Error(postErr.message);
  if (!postRow) throw new Error("Post nie istnieje.");
  const post = postRow as {
    id: string;
    organization_id: string;
    target_platforms: string[];
    content_per_platform: Record<string, PlatformPostContent>;
    status: string;
  };

  // 2) ustaw status 'publishing'
  await supabaseAdmin
    .from("social_posts")
    .update({ status: "publishing", updated_at: nowIso })
    .eq("id", post.id);

  const results: Record<string, PerPlatformResult> = {};
  let hadSuccess = false;
  let hadError = false;

  // 3) per platforma — adapter + publikacja
  for (const platform of post.target_platforms) {
    const content = post.content_per_platform[platform] ?? {};
    const adapter = getAdapter(platform);

    if (!adapter) {
      results[platform] = {
        status: "skipped_no_adapter",
        errorMessage: `Integracja dla platformy ${platform} nie jest jeszcze aktywna.`,
      };
      await upsertResult(post.id, platform, results[platform]);
      continue;
    }

    try {
      const ctx = await getValidAccount({
        organizationId: post.organization_id,
        platform,
      });
      if (!ctx) {
        results[platform] = {
          status: "skipped_no_account",
          errorMessage: "Brak podłączonego konta tej platformy w organizacji.",
        };
        await upsertResult(post.id, platform, results[platform]);
        continue;
      }
      const pub = await adapter.publish({
        account: ctx.account,
        content,
        clientId: ctx.credentials.clientId,
        clientSecret: ctx.credentials.clientSecret,
      });
      results[platform] = {
        status: "success",
        externalPostId: pub.externalPostId,
        externalUrl: pub.externalUrl,
      };
      hadSuccess = true;
      await clearAccountError(ctx.account.id);
      await upsertResult(post.id, platform, results[platform]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results[platform] = { status: "error", errorMessage: msg };
      hadError = true;
      // spróbuj oznaczyć konto błędem jeśli istnieje
      try {
        const { data: acct } = await supabaseAdmin
          .from("social_accounts")
          .select("id")
          .eq("organization_id", post.organization_id)
          .eq("platform", platform)
          .maybeSingle();
        if (acct) await markAccountError((acct as { id: string }).id, msg);
      } catch {
        // ignore
      }
      await upsertResult(post.id, platform, results[platform]);
    }
  }

  // 4) finalny status postu
  const finalStatus = hadSuccess
    ? "published"
    : hadError
      ? "failed"
      : "draft"; // wszystkie skipped — wracamy do draftu
  const update: Record<string, unknown> = {
    status: finalStatus,
    updated_at: new Date().toISOString(),
  };
  if (finalStatus === "published") update.published_at = new Date().toISOString();
  await supabaseAdmin.from("social_posts").update(update).eq("id", post.id);

  return results;
}

async function upsertResult(
  postId: string,
  platform: string,
  r: PerPlatformResult,
): Promise<void> {
  await supabaseAdmin.from("social_post_results").upsert(
    {
      post_id: postId,
      platform,
      status: r.status,
      external_post_id: r.externalPostId ?? null,
      external_url: r.externalUrl ?? null,
      error_message: r.errorMessage ?? null,
      published_at: new Date().toISOString(),
    },
    { onConflict: "post_id,platform" },
  );
}
