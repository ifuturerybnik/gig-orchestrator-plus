// CRON tick: finalne usuwanie organizacji po upływie 7-dniowej karencji.
// Wymagany nagłówek X-Cron-Secret = process.env.CRON_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/org-deletion-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const nowIso = new Date().toISOString();
        const { data: orgs, error } = await supabaseAdmin
          .from("organizations")
          .select("id, name")
          .not("deletion_scheduled_for", "is", null)
          .lte("deletion_scheduled_for", nowIso);
        if (error) return new Response(error.message, { status: 500 });
        const results: Array<{ id: string; name: string; ok: boolean; error?: string }> = [];
        for (const org of orgs ?? []) {
          const { error: delErr } = await supabaseAdmin
            .from("organizations")
            .delete()
            .eq("id", org.id as string);
          results.push({
            id: org.id as string,
            name: (org.name as string) ?? "",
            ok: !delErr,
            error: delErr?.message,
          });
        }
        return Response.json({ ok: true, deleted: results.length, results });
      },
    },
  },
});
