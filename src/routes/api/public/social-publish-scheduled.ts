// Cron tick publikacji zaplanowanych postów SM.
// Wymagany nagłówek X-Cron-Secret = process.env.CRON_SECRET.
//
// Algorytm:
//  1. Pobierz social_posts o status='scheduled' i scheduled_at <= now().
//  2. Dla każdego postu i każdej platformy docelowej:
//     - jeśli organizacja NIE ma podłączonego konta tej platformy →
//       wpis do social_post_results: status='skipped_no_account'
//     - jeśli ma konto, ale OAuth tej platformy nie jest jeszcze
//       zaimplementowany w turze produkcyjnej → 'pending_oauth'
//     - (Tura 3+) tu wskoczy realne wywołanie API per platforma.
//  3. Aktualizuj status postu:
//     - wszystkie platformy 'skipped_no_account' lub 'pending_oauth' →
//       post pozostaje 'scheduled' (spróbujemy ponownie gdy OAuth ruszy)
//       ale zapisujemy ostrzeżenie w notes.
//     - jeśli >=1 platforma 'success' → 'published' z published_at.
//     - jeśli >=1 'error' a 0 'success' → 'failed'.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AccountRow = { id: string; platform: string; organization_id: string };
type PostRow = {
  id: string;
  organization_id: string;
  target_platforms: string[];
  scheduled_at: string;
};

async function processTick() {
  const nowIso = new Date().toISOString();
  const { data: posts, error } = await supabaseAdmin
    .from("social_posts")
    .select("id, organization_id, target_platforms, scheduled_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  const list = (posts ?? []) as PostRow[];

  const summary: Array<{ post_id: string; results: Record<string, string> }> = [];

  for (const post of list) {
    const { data: accounts } = await supabaseAdmin
      .from("social_accounts")
      .select("id, platform, organization_id")
      .eq("organization_id", post.organization_id)
      .in("platform", post.target_platforms.length ? post.target_platforms : [""]);

    const accountByPlatform = new Map<string, AccountRow>();
    for (const a of (accounts ?? []) as AccountRow[]) accountByPlatform.set(a.platform, a);

    const results: Record<string, string> = {};
    let hadSuccess = false;
    let hadError = false;

    for (const platform of post.target_platforms) {
      const acct = accountByPlatform.get(platform);
      const status = acct ? "pending_oauth" : "skipped_no_account";
      const errorMessage = acct
        ? "Integracja OAuth dla tej platformy zostanie aktywowana w kolejnej turze."
        : "Brak podłączonego konta tej platformy w organizacji.";

      // Upsert wyniku
      await supabaseAdmin
        .from("social_post_results")
        .upsert(
          {
            post_id: post.id,
            platform,
            status,
            error_message: errorMessage,
            published_at: nowIso,
          },
          { onConflict: "post_id,platform" },
        );

      results[platform] = status;
      if (status === "error") hadError = true;
    }

    // Aktualizacja statusu postu — na razie zawsze 'scheduled' (czeka na OAuth)
    // ale notes informuje co się stało.
    const notes = `Auto-tick ${nowIso}: ${Object.entries(results)
      .map(([p, s]) => `${p}=${s}`)
      .join(", ")}`;

    const newStatus = hadSuccess
      ? "published"
      : hadError && !hadSuccess
        ? "failed"
        : "scheduled"; // wszystko pending_oauth/skipped → spróbujemy ponownie

    const updates: Record<string, unknown> = {
      status: newStatus,
      notes,
      updated_at: nowIso,
    };
    if (newStatus === "published") updates.published_at = nowIso;
    if (newStatus === "scheduled") {
      // Przesuń kolejną próbę o 24h żeby nie spamować tablicy results
      updates.scheduled_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    }

    await supabaseAdmin.from("social_posts").update(updates).eq("id", post.id);

    summary.push({ post_id: post.id, results });
  }

  return { processed: summary.length, items: summary };
}

export const Route = createFileRoute("/api/public/social-publish-scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const result = await processTick();
          return Response.json({ ok: true, ...result });
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
