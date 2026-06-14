// Server functions dla skanerów Bazy PP (BAE / RSPO / GUS).
// Każda zwraca listę propozycji uzupełnień; aplikuje je osobna fn applyScannerUpdates.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const scopeSchema = z.object({
  scope: z.enum(["selected", "missing_target"]),
  ids: z.array(z.string().uuid()).max(10_000).optional(),
});

const ENTITY_COLS =
  "id, name, miejscowosc, wojewodztwo, regon, edoreczenia_ade, phone, email, www, nip, kod_pocztowy, ulica, nr_domu";

type EntityRow = {
  id: string;
  name: string | null;
  miejscowosc: string | null;
  wojewodztwo: string | null;
  regon: string | null;
  edoreczenia_ade: string | null;
  phone: string | null;
  email: string | null;
  www: string | null;
  nip: string | null;
  kod_pocztowy: string | null;
  ulica: string | null;
  nr_domu: string | null;
};

async function loadEntitiesForScan(
  supabase: SupabaseClient,
  scope: "selected" | "missing_target",
  ids: string[] | undefined,
  missingColumn: string,
): Promise<EntityRow[]> {
  if (scope === "selected") {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase
      .from("public_entities")
      .select(ENTITY_COLS)
      .in("id", ids)
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as EntityRow[];
  }
  const { data, error } = await supabase
    .from("public_entities")
    .select(ENTITY_COLS)
    .is(missingColumn, null)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as EntityRow[];
}

// ============================================================================
// BAE (e-Doręczenia)
// ============================================================================

export const scanBaeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, false);

    const entities = await loadEntitiesForScan(
      supabase,
      data.scope,
      data.ids,
      "edoreczenia_ade",
    );


    const { matchInBae } = await import("./scanners/bae.server");
    const matches = await matchInBae(
      entities.map((e) => ({
        id: e.id,
        name: e.name,
        miejscowosc: e.miejscowosc,
        wojewodztwo: e.wojewodztwo,
        regon: e.regon,
        currentAde: e.edoreczenia_ade,
      })),
    );

    // Mapuj propozycje na patch (ADE + REGON, jeśli różne od aktualnych).
    return {
      source: "bae" as const,
      total: entities.length,
      items: entities.map((e) => {
        const m = matches.find((x) => x.entityId === e.id)!;
        const target = m.match;
        const patch: Record<string, string> = {};
        if (target) {
          if (target.ADE && target.ADE !== e.edoreczenia_ade) {
            patch.edoreczenia_ade = target.ADE;
          }
          if (target.REGON && target.REGON !== e.regon) {
            patch.regon = target.REGON;
          }
        }
        return {
          entityId: e.id,
          entity: {
            name: e.name,
            miejscowosc: e.miejscowosc,
            wojewodztwo: e.wojewodztwo,
            regon: e.regon,
            edoreczenia_ade: e.edoreczenia_ade,
          },
          confidence: m.confidence,
          score: m.score,
          match: target
            ? {
                name: target.NAZWA_PODMIOTU,
                miejscowosc: target.MIEJSCOWOSC,
                wojewodztwo: target.WOJEWODZTWO,
                regon: target.REGON,
                ade: target.ADE,
              }
            : null,
          candidates:
            m.candidates?.slice(0, 5).map((c) => ({
              name: c.NAZWA_PODMIOTU,
              miejscowosc: c.MIEJSCOWOSC,
              regon: c.REGON,
              ade: c.ADE,
            })) ?? [],
          patch,
        };
      }),
    };
  });

// ============================================================================
// RSPO / GUS — placeholdery zgłaszające status (do uzupełnienia w kolejnych turach)
// ============================================================================

export const scanRspoMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.parse(input))
  .handler(async ({ context }) => {
    await assertAppAdmin(context.supabase, context.userId, false);
    throw new Error(
      "Skaner RSPO jeszcze nie jest wdrożony. Zostanie dodany w kolejnym kroku.",
    );
  });

export const scanGusMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => scopeSchema.parse(input))
  .handler(async ({ context }) => {
    await assertAppAdmin(context.supabase, context.userId, false);
    const hasKey = !!process.env.EXT_GUS_BIR_KEY;
    throw new Error(
      hasKey
        ? "Skaner GUS REGON jeszcze nie jest wdrożony. Zostanie dodany w kolejnym kroku."
        : "Skaner GUS REGON wymaga klucza EXT_GUS_BIR_KEY z api.stat.gov.pl. Skontaktuj się z administratorem aplikacji.",
    );
  });

// ============================================================================
// Apply (bulk update zaakceptowanych propozycji)
// ============================================================================

const ALLOWED_PATCH_FIELDS = new Set([
  "edoreczenia_ade",
  "epuap_address",
  "regon",
  "nip",
  "phone",
  "phone_ext",
  "email",
  "www",
  "kod_pocztowy",
  "ulica",
  "nr_domu",
  "miejscowosc",
  "powiat",
  "wojewodztwo",
  "poczta",
]);

const applySchema = z.object({
  source: z.enum(["bae", "rspo", "gus"]),
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        patch: z.record(z.string(), z.string().max(500)),
      }),
    )
    .min(1)
    .max(5000),
});

export const applyScannerUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId, true);

    let updated = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const u of data.updates) {
      const clean: Record<string, string | null> = { updated_by: userId };
      for (const [k, v] of Object.entries(u.patch)) {
        if (!ALLOWED_PATCH_FIELDS.has(k)) continue;
        clean[k] = v.trim() === "" ? null : v.trim();
      }
      clean.source = `scanner:${data.source}`;
      const { error } = await supabase
        .from("public_entities")
        .update(clean)
        .eq("id", u.id);
      if (error) errors.push({ id: u.id, message: error.message });
      else updated++;
    }
    return { updated, errors, total: data.updates.length };
  });
