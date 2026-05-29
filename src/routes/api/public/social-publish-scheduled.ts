// Cron tick publikacji zaplanowanych postów SM.
// Wymagany nagłówek X-Cron-Secret = process.env.CRON_SECRET.
//
// Bierze posty o status='scheduled' i scheduled_at <= now(), a następnie
// dla każdego wywołuje centralny dispatcher `publishPostToAllPlatforms`,
// który publikuje na wszystkich platformach z aktywnym adapterem
// (`src/lib/platforms/index.server.ts`).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publishPostToAllPlatforms } from "@/lib/social-publish.server";

type PostRow = {
  id: string;
  organization_id: string;
};

async function processTick() {
  const nowIso = new Date().toISOString();
  const { data: posts, error } = await supabaseAdmin
    .from("social_posts")
    .select("id, organization_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  const list = (posts ?? []) as PostRow[];

  const summary: Array<{ post_id: string; results: Record<string, string> }> = [];
  for (const post of list) {
    try {
      const results = await publishPostToAllPlatforms({
        postId: post.id,
        organizationId: post.organization_id,
      });
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(results)) flat[k] = v.status;
      summary.push({ post_id: post.id, results: flat });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[social-publish-scheduled] post failed", post.id, msg);
      await supabaseAdmin
        .from("social_posts")
        .update({
          status: "failed",
          notes: msg.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
      summary.push({ post_id: post.id, results: { _post: `error: ${msg}` } });
    }
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
          return Response.json({ ok: true, result });
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
