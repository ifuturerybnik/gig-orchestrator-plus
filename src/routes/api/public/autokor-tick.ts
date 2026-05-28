// CRON tick autokorespondencji. Wywoływany co minutę przez pg_cron / zewnętrzny
// scheduler. Wymagany nagłówek X-Cron-Secret = process.env.CRON_SECRET.
//
// Algorytm:
//  1. Pobierz wszystkie kampanie status=running.
//  2. Dla każdej sprawdź harmonogram (godziny + dni tygodnia + timezone).
//  3. Wyślij do rate_per_min wiadomości (status=pending) przez engine.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  dispatchPendingForKampania,
  isWithinSchedule,
} from "@/lib/autokor-engine.server";

export const Route = createFileRoute("/api/public/autokor-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return new Response("CRON_SECRET not configured", { status: 500 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { data: kampanie } = await supabaseAdmin
          .from("autokorespondencje")
          .select("id, godziny_od, godziny_do, dni_tygodnia, rate_per_min, timezone")
          .eq("status", "running");

        const results: Array<{ id: string; sent: number; failed: number; skipped?: boolean }> = [];
        for (const k of kampanie ?? []) {
          const within = isWithinSchedule(
            String(k.godziny_od),
            String(k.godziny_do),
            (k.dni_tygodnia as number[]) ?? [1, 2, 3, 4, 5],
            String(k.timezone ?? "Europe/Warsaw"),
          );
          if (!within) {
            results.push({ id: k.id as string, sent: 0, failed: 0, skipped: true });
            continue;
          }
          const r = await dispatchPendingForKampania(k.id as string, Number(k.rate_per_min ?? 10));
          results.push({ id: k.id as string, ...r });
        }
        return Response.json({ ok: true, results });
      },
      GET: async ({ request }) => {
        // umożliwia ręczne wywołanie z dashboardu (GET też dla testów)
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        return Response.json({ ok: true, hint: "Use POST to run tick" });
      },
    },
  },
});
