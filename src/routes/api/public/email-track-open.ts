// Pixel 1x1 GIF — raportuje otwarcie wiadomości autokorespondencji.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const Route = createFileRoute("/api/public/email-track-open")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const k = url.searchParams.get("k");
          const m = url.searchParams.get("m");
          if (k && m) {
            const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;
            await supabaseAdmin.from("email_otwarcia").insert({
              kampania_id: k,
              kampania_wiadomosc_id: m,
              user_agent: ua,
            });
            const { data: row } = await supabaseAdmin
              .from("autokorespondencje_wiadomosci")
              .select("otwarcia")
              .eq("id", m)
              .maybeSingle();
            if (row) {
              await supabaseAdmin
                .from("autokorespondencje_wiadomosci")
                .update({ otwarcia: Number(row.otwarcia ?? 0) + 1 })
                .eq("id", m);
            }
          }
        } catch {
          // ignoruj — zawsze zwracamy pixel
        }
        return new Response(PIXEL, {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Content-Length": String(PIXEL.length),
          },
        });
      },
    },
  },
});
