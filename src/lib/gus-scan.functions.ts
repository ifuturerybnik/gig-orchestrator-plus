// Server functions dla masowego skanowania GUS REGON (BIR1.1).
// Zlecenia są zapisywane w tabeli gus_scan_jobs i przetwarzane asynchronicznie
// przez worker /api/public/gus-scan-tick — działają nawet po wylogowaniu użytkownika.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GUS_SCAN_FIELDS = [
  "nip",
  "regon",
  "krs",
  "name",
  "wojewodztwo",
  "powiat",
  "gmina",
  "miejscowosc",
  "kod_pocztowy",
  "poczta",
  "ulica",
  "nr_domu",
] as const;
export type GusScanField = (typeof GUS_SCAN_FIELDS)[number];

async function assertAdmin(sb: SupabaseClient, userId: string) {
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const list = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!list.includes("super_admin") && !list.includes("admin_staff")) {
    throw new Error("Forbidden");
  }
}

const startSchema = z.object({
  identifier: z.enum(["nip", "regon", "krs"]),
  fields: z.array(z.enum(GUS_SCAN_FIELDS)).min(1),
  scope: z.enum(["selected", "all"]),
  ids: z.array(z.string().uuid()).max(20_000).optional(),
});

export const startGusScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => startSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Wczytaj listę encji do przetworzenia — wymagamy, żeby miały identyfikator.
    let q = supabase
      .from("public_entities")
      .select("id")
      .not(data.identifier, "is", null)
      .limit(20_000);
    if (data.scope === "selected") {
      if (!data.ids || data.ids.length === 0) throw new Error("Brak zaznaczonych rekordów");
      q = q.in("id", data.ids);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const entityIds = (rows ?? []).map((r) => (r as { id: string }).id);
    if (entityIds.length === 0) {
      throw new Error("Brak rekordów z wybranym identyfikatorem do przeskanowania.");
    }

    const { data: job, error: insErr } = await supabase
      .from("gus_scan_jobs")
      .insert({
        created_by: userId,
        identifier: data.identifier,
        fields: data.fields,
        entity_ids: entityIds,
        total: entityIds.length,
        status: "queued",
        log: [
          {
            ts: Date.now(),
            level: "info",
            text: `Zlecenie utworzone (${entityIds.length} rekordów po ${data.identifier.toUpperCase()}).`,
          },
        ],
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Best-effort: spróbuj kopnąć worker od razu (jeśli CRON_SECRET dostępny).
    try {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://concertivo.eu";
        await fetch(`${origin}/api/public/gus-scan-tick`, {
          method: "POST",
          headers: { "x-cron-secret": cronSecret, "content-type": "application/json" },
          body: "{}",
        }).catch(() => {});
      }
    } catch {
      // ignore — cron i tak zabierze job
    }

    return { jobId: (job as { id: string }).id };
  });

const idSchema = z.object({ jobId: z.string().uuid() });

export const getGusScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job, error } = await supabase
      .from("gus_scan_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Zlecenie nie znalezione");
    return { job };
  });

export const cancelGusScanJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("gus_scan_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyGusScanJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("gus_scan_jobs")
      .select("id, identifier, total, processed, updated_count, status, created_at, finished_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });
