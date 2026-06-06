// Cron: synchronizacja postów opublikowanych poza aplikacją.
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET. Częstotliwość: co 30 min.
// Pomija konta z auto_sync_inbox=false lub aktywną pauzą (sync_paused_until > now).
// Limity (per-account, max kont) — w app_settings.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { importPostsFromAccount } from "@/lib/social-import.server";
import { getAdapter } from "@/lib/platforms/index.server";
import { getSocialSettings, recordSyncRun } from "@/lib/social-settings.server";

type AccountRow = {
  id: string;
  organization_id: string;
  platform: string;
  auto_sync_inbox: boolean;
  sync_paused_until: string | null;
};

async function processTick() {
  const startedAt = Date.now();
  const settings = await getSocialSettings();

  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select("id, organization_id, platform, auto_sync_inbox, sync_paused_until")
    .eq("status", "connected")
    .not("access_token_enc", "is", null)
    .limit(settings.importMaxAccounts);
  if (error) throw new Error(error.message);
  const accounts = (data ?? []) as AccountRow[];

  let ok = 0;
  let fail = 0;
  let skippedDisabled = 0;
  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: Array<{ ref: string; message: string }> = [];

  for (const acc of accounts) {
    const adapter = getAdapter(acc.platform);
    if (!adapter?.listRecentPosts) continue;
    const pausedActive =
      !!acc.sync_paused_until && new Date(acc.sync_paused_until) > new Date();
    if (!acc.auto_sync_inbox || pausedActive) {
      skippedDisabled++;
      continue;
    }
    try {
      const res = await importPostsFromAccount({
        organizationId: acc.organization_id,
        platform: acc.platform,
        limit: settings.importPerAccountLimit,
      });
      ok++;
      totalFetched += res.fetched;
      totalInserted += res.inserted;
      totalSkipped += res.skipped;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[social-import-posts]", acc.platform, acc.id, msg);
      fail++;
      if (errors.length < 10) errors.push({ ref: `${acc.platform}:${acc.id}`, message: msg });
    }
  }

  await recordSyncRun({
    job: "import-posts",
    startedAt,
    processed: accounts.length,
    inserted: totalInserted,
    ok,
    fail,
    skippedDisabled,
    errors,
    notes: `fetched=${totalFetched} skipped=${totalSkipped}`,
  });

  return {
    processed: accounts.length,
    ok,
    fail,
    skippedDisabled,
    totals: { fetched: totalFetched, inserted: totalInserted, skipped: totalSkipped },
  };
}

export const Route = createFileRoute("/api/public/social-import-posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const out = await processTick();
          return Response.json({ success: true, result: out });
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
