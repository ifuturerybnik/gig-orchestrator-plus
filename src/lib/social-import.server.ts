// SERVER-ONLY. Import / synchronizacja postów opublikowanych POZA aplikacją.
//
// Dla każdego połączonego konta wywołuje adapter.listRecentPosts() i wstawia
// nowe pozycje jako social_posts (status='published', source='imported')
// + social_post_results (status='success', external_post_id). Dzięki temu
// istniejące crony social-sync-metrics i social-sync-inbox automatycznie
// zaczynają zbierać metryki i komentarze dla zaimportowanych wpisów.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clearAccountError,
  getAdapter,
  getValidAccount,
  markAccountError,
} from "./platforms/index.server";

export type ImportSummary = {
  fetched: number;
  inserted: number;
  skipped: number;
};

export async function importPostsFromAccount(args: {
  organizationId: string;
  platform: string;
  limit?: number;
}): Promise<ImportSummary> {
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);

  const adapter = getAdapter(args.platform);
  if (!adapter || !adapter.listRecentPosts) {
    throw new Error(
      `Import postów nie jest jeszcze wspierany dla platformy ${args.platform}.`,
    );
  }

  const ctx = await getValidAccount({
    organizationId: args.organizationId,
    platform: args.platform,
  });
  if (!ctx) {
    throw new Error("Brak podłączonego konta tej platformy w organizacji.");
  }

  // Potrzebujemy created_by do social_posts (NOT NULL) — bierzemy connected_by konta.
  const { data: acctRow, error: acctErr } = await supabaseAdmin
    .from("social_accounts")
    .select("id, connected_by")
    .eq("id", ctx.account.id)
    .maybeSingle();
  if (acctErr) throw new Error(acctErr.message);
  const connectedBy = (acctRow as { connected_by: string } | null)?.connected_by;
  if (!connectedBy) {
    throw new Error("Nie udało się ustalić właściciela połączonego konta.");
  }

  let recent;
  try {
    recent = await adapter.listRecentPosts({
      account: ctx.account,
      limit,
      clientId: ctx.credentials.clientId,
      clientSecret: ctx.credentials.clientSecret,
    });
    await clearAccountError(ctx.account.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markAccountError(ctx.account.id, msg);
    throw e;
  }

  if (recent.length === 0) {
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  // Deduplikacja: w jednym query wybieramy wszystkie istniejące external_post_id
  // dla pary (organization_id, platform) z tego zestawu.
  const externalIds = recent.map((p) => p.externalPostId);
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("social_post_results")
    .select(
      "external_post_id, post:social_posts!inner(organization_id)",
    )
    .eq("platform", args.platform)
    .in("external_post_id", externalIds)
    .eq("post.organization_id", args.organizationId);
  if (existErr) throw new Error(existErr.message);

  const known = new Set(
    ((existing ?? []) as unknown as Array<{ external_post_id: string }>).map(
      (r) => r.external_post_id,
    ),
  );

  const toInsert = recent.filter((p) => !known.has(p.externalPostId));
  if (toInsert.length === 0) {
    return { fetched: recent.length, inserted: 0, skipped: recent.length };
  }

  let inserted = 0;
  for (const p of toInsert) {
    const publishedAt = p.postedAt ?? new Date().toISOString();
    const { data: postRow, error: postErr } = await supabaseAdmin
      .from("social_posts")
      .insert({
        organization_id: args.organizationId,
        created_by: connectedBy,
        target_platforms: [args.platform],
        content_per_platform: {
          [args.platform]: {
            text: p.text,
            media_urls: p.mediaUrls,
          },
        },
        status: "published",
        published_at: publishedAt,
        source: "imported",
        notes: "Zaimportowane z platformy (post opublikowany poza Concertivo).",
      })
      .select("id")
      .maybeSingle();
    if (postErr) {
      console.error("[social-import] insert post failed", postErr.message);
      continue;
    }
    const postId = (postRow as { id: string } | null)?.id;
    if (!postId) continue;

    const { error: resErr } = await supabaseAdmin
      .from("social_post_results")
      .insert({
        post_id: postId,
        platform: args.platform,
        status: "success",
        external_post_id: p.externalPostId,
        external_url: p.externalUrl,
        published_at: publishedAt,
      });
    if (resErr) {
      console.error("[social-import] insert result failed", resErr.message);
      continue;
    }
    inserted++;
  }

  return {
    fetched: recent.length,
    inserted,
    skipped: recent.length - inserted,
  };
}
