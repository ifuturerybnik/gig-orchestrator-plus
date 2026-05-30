// Cron: synchronizacja inboxa (nowe komentarze/odpowiedzi) dla opublikowanych postów.
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET.
// Częstotliwość zalecana: co 15 minut.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdapter, getValidAccount } from "@/lib/platforms/index.server";
import { MetaPermissionError } from "@/lib/platforms/meta.server";

type ResultRow = {
  post_id: string;
  platform: string;
  external_post_id: string | null;
  published_at: string | null;
  post: { organization_id: string } | null;
};

async function processTick() {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("social_post_results")
    .select(
      "post_id, platform, external_post_id, published_at, post:social_posts!inner(organization_id)",
    )
    .eq("status", "success")
    .not("external_post_id", "is", null)
    .gte("published_at", since)
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ResultRow[];

  let totalInserted = 0;
  let fail = 0;
  let skippedPermission = 0;
  for (const r of rows) {
    if (!r.external_post_id || !r.post) continue;
    const adapter = getAdapter(r.platform);
    if (!adapter) continue;
    try {
      const ctx = await getValidAccount({
        organizationId: r.post.organization_id,
        platform: r.platform,
      });
      if (!ctx) continue;

      // Pobierz najnowszy komentarz dla posta — żeby zapytać platformę tylko o "od tej daty".
      const { data: latest } = await supabaseAdmin
        .from("social_comments")
        .select("posted_at")
        .eq("organization_id", r.post.organization_id)
        .eq("platform", r.platform)
        .eq("external_post_id", r.external_post_id)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const sinceIso =
        (latest as { posted_at: string | null } | null)?.posted_at ??
        r.published_at ??
        null;

      const items = await adapter.fetchInboxItems({
        account: ctx.account,
        externalPostId: r.external_post_id,
        sinceIso,
        clientId: ctx.credentials.clientId,
        clientSecret: ctx.credentials.clientSecret,
      });
      if (!items.length) continue;

      // upsert — kluczem unikalności jest (organization_id, platform, external_comment_id)
      const rowsToInsert = items.map((it) => ({
        organization_id: r.post!.organization_id,
        account_id: ctx.account.id,
        platform: r.platform,
        post_id: r.post_id,
        external_post_id: it.externalPostId,
        external_comment_id: it.externalCommentId,
        external_parent_comment_id: it.externalParentCommentId ?? null,
        author_external_id: it.authorExternalId,
        author_name: it.authorName,
        author_avatar_url: it.authorAvatarUrl,
        content: it.content,
        permalink: it.permalink,
        posted_at: it.postedAt,
        like_count: it.likeCount ?? 0,
        reply_count: it.replyCount ?? 0,
        status: "new",
      }));

      const { error: upErr, count } = await supabaseAdmin
        .from("social_comments")
        .upsert(rowsToInsert, {
          onConflict: "organization_id,platform,external_comment_id",
          ignoreDuplicates: true,
          count: "exact",
        });
      if (upErr) throw new Error(upErr.message);
      totalInserted += count ?? rowsToInsert.length;
    } catch (e) {
      if (e instanceof MetaPermissionError) {
        skippedPermission++;
        continue;
      }
      fail++;
      console.error("[social-sync-inbox]", r.platform, r.post_id, e);
    }
  }
  return { processed: rows.length, inserted: totalInserted, fail, skippedPermission };
}

export const Route = createFileRoute("/api/public/social-sync-inbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const out = await processTick();
          return Response.json({ ok: true, ...out });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        return Response.json({ ok: true, hint: "Use POST to run tick" });
      },
    },
  },
});
