// CRUD kampanii autokorespondencji. Generowanie wiadomości i wysyłka
// odbywa się przez cron tick (osobny endpoint /api/public/autokor-tick).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SAFE =
  "id, organization_id, skrzynka_id, created_by, nazwa, status, temat, body_html, szablon_id, filtry, start_at, end_at, godziny_od, godziny_do, dni_tygodnia, rate_per_min, timezone, total_odbiorcow, created_at, updated_at";

async function ensureMember(userId: string, orgId: string) {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listKampanie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.userId, data.organizationId);
    const { data: rows, error } = await supabaseAdmin
      .from("autokorespondencje")
      .select(SAFE)
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { kampanie: rows ?? [] };
  });

export const getKampania = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("autokorespondencje")
      .select(SAFE)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    await ensureMember(context.userId, row.organization_id as string);
    return { kampania: row };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  skrzynkaId: z.string().uuid(),
  nazwa: z.string().trim().min(1).max(200),
  temat: z.string().max(500).default(""),
  body_html: z.string().max(2_000_000).default(""),
  szablon_id: z.string().uuid().nullable().optional(),
  filtry: z.record(z.string(), z.unknown()).default({}),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
  godziny_od: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default("09:00"),
  godziny_do: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default("17:00"),
  dni_tygodnia: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
  rate_per_min: z.number().int().min(1).max(120).default(10),
  timezone: z.string().max(80).default("Europe/Warsaw"),
});

export const upsertKampania = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureMember(context.userId, data.organizationId);
    const payload = {
      organization_id: data.organizationId,
      skrzynka_id: data.skrzynkaId,
      created_by: context.userId,
      nazwa: data.nazwa,
      temat: data.temat,
      body_html: data.body_html,
      szablon_id: data.szablon_id ?? null,
      filtry: data.filtry,
      start_at: data.start_at ?? null,
      end_at: data.end_at ?? null,
      godziny_od: data.godziny_od,
      godziny_do: data.godziny_do,
      dni_tygodnia: data.dni_tygodnia,
      rate_per_min: data.rate_per_min,
      timezone: data.timezone,
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("autokorespondencje")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select(SAFE)
        .single();
      if (error) throw new Error(error.message);
      return { kampania: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("autokorespondencje")
      .insert(payload)
      .select(SAFE)
      .single();
    if (error) throw new Error(error.message);
    return { kampania: row };
  });

export const setKampaniaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "scheduled", "running", "paused", "done", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("autokorespondencje")
      .select("organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    await ensureMember(context.userId, row.organization_id as string);
    const { error } = await supabaseAdmin
      .from("autokorespondencje")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKampania = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("autokorespondencje")
      .select("organization_id, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    await ensureMember(context.userId, row.organization_id as string);
    const { error } = await supabaseAdmin
      .from("autokorespondencje")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
