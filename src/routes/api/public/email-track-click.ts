// Redirect z logowaniem kliknięcia.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/email-track-click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const k = url.searchParams.get("k");
        const m = url.searchParams.get("m");
        const target = url.searchParams.get("u");
        if (!target) return new Response("Bad request", { status: 400 });
        let safe = target;
        try {
          const t = new URL(target);
          if (!/^https?:$/.test(t.protocol)) return new Response("Bad URL", { status: 400 });
          safe = t.toString();
        } catch {
          return new Response("Bad URL", { status: 400 });
        }
        try {
          if (k && m) {
            const { data: row } = await supabaseAdmin
              .from("autokorespondencje_wiadomosci")
              .select("klikniecia")
              .eq("id", m)
              .maybeSingle();
            if (row) {
              await supabaseAdmin
                .from("autokorespondencje_wiadomosci")
                .update({ klikniecia: Number(row.klikniecia ?? 0) + 1 })
                .eq("id", m);
            }
          }
        } catch {
          // ignore
        }
        return new Response(null, {
          status: 302,
          headers: { Location: safe, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
