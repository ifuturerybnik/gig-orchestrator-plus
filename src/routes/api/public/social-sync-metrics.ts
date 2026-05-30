// Cron: synchronizacja metryk dla opublikowanych postów (per platforma z adapterem).
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET.
// Częstotliwość zalecana: co 1h.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdapter, getValidAccount } from "@/lib/platforms/index.server";
import { MetaPermissionError } from "@/lib/platforms/meta.server";

type ResultRow = {
  post_id: string;
  platform: string;
  external_post_id: string | null;
  post: { organization_id: string } | null;
};

async function processTick() {
  // Bierzemy posty opublikowane w ostatnich 30 dniach (metryki rosną głównie krótko po publikacji).
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("social_post_results")
    .select(
      "post_id, platform, external_post_id, post:social_posts!inner(organization_id)",
    )
    .eq("status", "success")
    .not("external_post_id", "is", null)
    .gte("published_at", since)
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ResultRow[];

  let okCount = 0;
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
      const m = await adapter.fetchMetrics({
        account: ctx.account,
        externalPostId: r.external_post_id,
        clientId: ctx.credentials.clientId,
        clientSecret: ctx.credentials.clientSecret,
      });
      await supabaseAdmin.from("social_post_metrics").insert({
        post_id: r.post_id,
        platform: r.platform,
        likes: m.likes,
        comments: m.comments,
        shares: m.shares,
        views: m.views,
        snapshot_at: new Date().toISOString(),
      });
      okCount++;
    } catch (e) {
      if (e instanceof MetaPermissionError) {
        skippedPermission++;
        continue;
      }
      fail++;
      console.error("[social-sync-metrics]", r.platform, r.post_id, e);
    }
  }
  return { processed: rows.length, ok: okCount, fail, skippedPermission };
}

export const Route = createFileRoute("/api/public/social-sync-metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const out = await processTick();
          return Response.json({ ok: true, result: out });
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
