// Worker tick — przetwarza zlecenia gus_scan_jobs.
// Wywoływany przez pg_cron / zewnętrzny scheduler nagłówkiem X-Cron-Secret.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/gus-scan-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { processGusScanTick } = await import("@/lib/gus-scan-worker.server");
        try {
          const result = await processGusScanTick();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
