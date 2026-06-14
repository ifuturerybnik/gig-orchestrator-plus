import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PUBLIC_ENTITY_TYPES = [
  "jst_gmina",
  "jst_powiat",
  "jst_wojewodztwo",
  "osrodek_kultury",
] as const;
export type PublicEntityType = (typeof PUBLIC_ENTITY_TYPES)[number];

async function assertAppAdmin(
  supabase: SupabaseClient,
  userId: string,
  requireSuper = false,
): Promise<{ isSuper: boolean }> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const list = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
  const isSuper = list.includes("super_admin");
  const isAdmin = isSuper || list.includes("admin_staff");
  if (requireSuper && !isSuper) throw new Error("Forbidden");
  if (!isAdmin) throw new Error("Forbidden");
  return { isSuper };
}

const entitySchema = z.object({
  entity_type: z.enum(PUBLIC_ENTITY_TYPES),
  name: z.string().trim().min(1).max(500),
  short_name: z.string().trim().max(300).nullable().optional(),
  teryt_code: z.string().trim().max(20).nullable().optional(),
  jst_type_raw: z.string().trim().max(120).nullable().optional(),
  wojewodztwo: z.string().trim().max(100).nullable().optional(),
  powiat: z.string().trim().max(150).nullable().optional(),
  miejscowosc: z.string().trim().max(200).nullable().optional(),
  kod_pocztowy: z.string().trim().max(15).nullable().optional(),
  poczta: z.string().trim().max(200).nullable().optional(),
  ulica: z.string().trim().max(200).nullable().optional(),
  nr_domu: z.string().trim().max(50).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  phone_ext: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().max(254).nullable().optional(),
  www: z.string().trim().max(500).nullable().optional(),
  epuap_address: z.string().trim().max(200).nullable().optional(),
  edoreczenia_ade: z.string().trim().max(200).nullable().optional(),
});

function normalize(input: z.infer<typeof entitySchema>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string" && v.trim() === "") out[k] = null;
  }
  return out;
}

const SELECT_COLS =
  "id, entity_type, name, short_name, teryt_code, jst_type_raw, wojewodztwo, powiat, miejscowosc, kod_pocztowy, poczta, ulica, nr_domu, phone, phone_ext, email, www, epuap_address, edoreczenia_ade, source, created_at, updated_at";

export const listPublicEntities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entityType: z.enum(PUBLIC_ENTITY_TYPES).nullable().optional(),
        wojewodztwo: z.string().trim().max(100).nullable().optional(),
        search: z.string().trim().max(200).nullable().optional(),
        page: z.number().int().min(1).max(10_000).optional(),
        pageSize: z.number().int().min(1).max(50_000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, false);

    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from("public_entities")
      .select(SELECT_COLS, { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);

    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.wojewodztwo) q = q.eq("wojewodztwo", data.wojewodztwo);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, " ").trim();
      if (s) {
        q = q.or(
          `name.ilike.%${s}%,miejscowosc.ilike.%${s}%,powiat.ilike.%${s}%`,
        );
      }
    }
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const getPublicEntity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, false);
    const { data: row, error } = await supabase
      .from("public_entities")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return { entity: row };
  });

export const createPublicEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => entitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, true);
    const payload = { ...normalize(data), source: "manual", created_by: userId, updated_by: userId };
    const { data: row, error } = await supabase
      .from("public_entities")
      .insert(payload)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { entity: row };
  });

export const updatePublicEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), patch: entitySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, true);
    const payload = { ...normalize(data.patch), updated_by: userId };
    const { data: row, error } = await supabase
      .from("public_entities")
      .update(payload)
      .eq("id", data.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { entity: row };
  });

export const deletePublicEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, true);
    const { error } = await supabase
      .from("public_entities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// === IMPORT (commit pre-parsed rows from client) ===
const importRowSchema = entitySchema.extend({
  source_row_hash: z.string().max(120).nullable().optional(),
});

export const commitPublicEntitiesImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        rows: z.array(importRowSchema).min(1).max(10_000),
        source: z.string().trim().max(200).default("import:manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, true);

    let inserted = 0;
    let updated = 0;
    const errors: Array<{ index: number; message: string }> = [];

    // Podziel: rekordy z teryt_code → upsert po teryt, bez teryt → insert
    const withTeryt: Array<Record<string, unknown>> = [];
    const withoutTeryt: Array<Record<string, unknown>> = [];

    data.rows.forEach((r, i) => {
      const cleaned: Record<string, unknown> = { ...normalize(r) };
      for (const k of Object.keys(cleaned)) {
        if (cleaned[k] === undefined) cleaned[k] = null;
      }
      cleaned.source = data.source;
      cleaned.updated_by = userId;
      if (!cleaned.teryt_code) {
        cleaned.created_by = userId;
        withoutTeryt.push({ __i: i, ...cleaned });
      } else {
        withTeryt.push({ __i: i, ...cleaned });
      }
    });

    // Upsert po teryt_code (chunki po 500)
    const CHUNK = 500;
    for (let i = 0; i < withTeryt.length; i += CHUNK) {
      const slice = withTeryt.slice(i, i + CHUNK);
      const payload = slice.map(({ __i, ...rest }) => rest);
      const { data: result, error } = await supabase
        .from("public_entities")
        .upsert(payload, { onConflict: "teryt_code", ignoreDuplicates: false })
        .select("id");
      if (error) {
        slice.forEach((s) =>
          errors.push({ index: s.__i as number, message: error.message }),
        );
      } else {
        // Nie wiemy ile to insert vs update — Supabase nie podaje. Liczymy łącznie.
        updated += result?.length ?? slice.length;
      }
    }
    for (let i = 0; i < withoutTeryt.length; i += CHUNK) {
      const slice = withoutTeryt.slice(i, i + CHUNK);
      const payload = slice.map(({ __i, ...rest }) => rest);
      const { data: result, error } = await supabase
        .from("public_entities")
        .insert(payload)
        .select("id");
      if (error) {
        slice.forEach((s) =>
          errors.push({ index: s.__i as number, message: error.message }),
        );
      } else {
        inserted += result?.length ?? slice.length;
      }
    }
    return { inserted, updated, errors, total: data.rows.length };
  });
