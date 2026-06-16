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
    // PostgREST ma domyślny max-rows (zwykle 1000), więc paginujemy przez .range()
    // żeby objąć całą bazę przy scope === "all" (do 200k rekordów).
    const entityIds: string[] = [];
    if (data.scope === "selected") {
      if (!data.ids || data.ids.length === 0) throw new Error("Brak zaznaczonych rekordów");
      // Chunkujemy .in() na wypadek bardzo długich list (URL/parser limit).
      const chunkSize = 500;
      for (let i = 0; i < data.ids.length; i += chunkSize) {
        const chunk = data.ids.slice(i, i + chunkSize);
        const { data: rows, error } = await supabase
          .from("public_entities")
          .select("id")
          .not(data.identifier, "is", null)
          .in("id", chunk);
        if (error) throw new Error(error.message);
        for (const r of rows ?? []) entityIds.push((r as { id: string }).id);
      }
    } else {
      const pageSize = 1000;
      const maxRecords = 200_000;
      for (let from = 0; from < maxRecords; from += pageSize) {
        const to = from + pageSize - 1;
        const { data: rows, error } = await supabase
          .from("public_entities")
          .select("id")
          .not(data.identifier, "is", null)
          .order("id", { ascending: true })
          .range(from, to);
        if (error) throw new Error(error.message);
        const list = (rows ?? []) as Array<{ id: string }>;
        for (const r of list) entityIds.push(r.id);
        if (list.length < pageSize) break;
      }
    }
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

export const runGusScanJobTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { processGusScanTick } = await import("./gus-scan-worker.server");
    return await processGusScanTick({ jobId: data.jobId, maxPerTick: 1 });
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
      .select("id, identifier, total, processed, updated_count, skipped_count, error_count, status, created_at, finished_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });
