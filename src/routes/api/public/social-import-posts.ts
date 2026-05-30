// Cron: synchronizacja postów opublikowanych poza aplikacją.
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET. Częstotliwość: co 30 min.
//
// Iteruje po wszystkich aktywnych kontach social_accounts (status='connected',
// posiadających access_token_enc) i dla każdego wywołuje importPostsFromAccount.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { importPostsFromAccount } from "@/lib/social-import.server";
import { getAdapter } from "@/lib/platforms/index.server";

const PER_ACCOUNT_LIMIT = 25;

type AccountRow = {
  id: string;
  organization_id: string;
  platform: string;
};

async function processTick() {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select("id, organization_id, platform")
    .eq("status", "connected")
    .not("access_token_enc", "is", null)
    .limit(500);
  if (error) throw new Error(error.message);
  const accounts = (data ?? []) as AccountRow[];

  const summary: Array<{
    account_id: string;
    platform: string;
    fetched: number;
    inserted: number;
    skipped: number;
    error?: string;
  }> = [];

  for (const acc of accounts) {
    const adapter = getAdapter(acc.platform);
    if (!adapter?.listRecentPosts) continue;
    try {
      const res = await importPostsFromAccount({
        organizationId: acc.organization_id,
        platform: acc.platform,
        limit: PER_ACCOUNT_LIMIT,
      });
      summary.push({
        account_id: acc.id,
        platform: acc.platform,
        ...res,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[social-import-posts]", acc.platform, acc.id, msg);
      summary.push({
        account_id: acc.id,
        platform: acc.platform,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        error: msg,
      });
    }
  }

  const totals = summary.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      inserted: acc.inserted + r.inserted,
      skipped: acc.skipped + r.skipped,
    }),
    { fetched: 0, inserted: 0, skipped: 0 },
  );

  return { processed: accounts.length, totals, items: summary };
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
