import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeOrgName } from "@/lib/normalizeOrgName";
import { ORG_TYPES, ARTIST_KINDS } from "@/lib/orgTypes";
import { MUSIC_GENRES } from "@/lib/genres";
import { normalizeNip } from "@/lib/nip";

const OrgTypeEnum = z.enum(ORG_TYPES as unknown as [string, ...string[]]);
const ArtistKindEnum = z.enum(ARTIST_KINDS as unknown as [string, ...string[]]);
const GenreEnum = z.enum(MUSIC_GENRES as unknown as [string, ...string[]]);
const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

/**
 * Sprawdza dostępność nazwy organizacji w bazie zarejestrowanych
 * kontrahentów (is_shared = true, status = 'approved').
 * Zwraca:
 *   - exact:   organizacje o identycznej znormalizowanej nazwie
 *   - similar: organizacje o podobnej nazwie (trigram similarity)
 */
export const checkOrgNameAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const normalized = normalizeOrgName(data.name);
    if (normalized.length < 2) {
      return { normalized, exact: [], similar: [] };
    }
    const limit = data.limit ?? 8;
    const { supabase, userId } = context;

    const cols =
      "id, name, legal_name, tax_id, address_city, address_country, address_street, address_building_no, address_postal_code, types, name_normalized";

    // Organizacje, których user jest członkiem — wykluczamy z wyników
    const { data: myMemberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const excludeIds = new Set(
      (myMemberships ?? []).map((m: { organization_id: string }) => m.organization_id),
    );

    // Exact (po znormalizowanej nazwie)
    const { data: exactRows, error: exactErr } = await supabaseAdmin
      .from("organizations")
      .select(cols)
      .eq("is_shared", true)
      .eq("status", "approved")
      .eq("name_normalized", normalized)
      .limit(limit);
    if (exactErr) throw new Error(exactErr.message);

    // Similar — ilike na całej znormalizowanej nazwie + tokenach 3+ znaków
    const tokens = normalized.split(" ").filter((t) => t.length >= 3);
    const orParts: string[] = [`name_normalized.ilike.%${normalized}%`];
    for (const t of tokens) orParts.push(`name_normalized.ilike.%${t}%`);

    const { data: similarRows, error: simErr } = await supabaseAdmin
      .from("organizations")
      .select(cols)
      .eq("is_shared", true)
      .eq("status", "approved")
      .neq("name_normalized", normalized)
      .or(orParts.join(","))
      .limit(limit);
    if (simErr) throw new Error(simErr.message);

    const exactIds = new Set((exactRows ?? []).map((r) => r.id));
    const filterOut = (r: { id: string }) =>
      !excludeIds.has(r.id);
    const exact = (exactRows ?? []).filter(filterOut);
    const similar = (similarRows ?? [])
      .filter((r) => !exactIds.has(r.id))
      .filter(filterOut);

    return {
      normalized,
      exact,
      similar,
    };
  });

/**
 * Dodaje istniejącą zarejestrowaną organizację jako kontrahenta zalogowanego
 * usera. Etap 1: tylko owner_kind = 'user'.
 */
export const addCounterpartyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        counterpartyOrgId: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Sprawdź czy kontrahent jest zarejestrowany i widoczny
    const { data: cp, error: cpErr } = await supabase
      .from("organizations")
      .select("id, is_shared, status")
      .eq("id", data.counterpartyOrgId)
      .maybeSingle();
    if (cpErr) throw new Error(cpErr.message);
    if (!cp || !cp.is_shared || cp.status !== "approved") {
      throw new Error("Wybrana organizacja nie jest dostępna jako kontrahent.");
    }

    const { data: row, error } = await supabase
      .from("counterparty_links")
      .insert({
        owner_kind: "user",
        owner_user_id: userId,
        counterparty_org_id: data.counterpartyOrgId,
        note: data.note ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Masz już tego kontrahenta na swojej liście.");
      }
      throw new Error(error.message);
    }
    return { link: row };
  });

/**
 * Lista moich kontrahentów (owner_kind = 'user').
 */
export const listMyCounterparties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from("counterparty_links")
      .select("id, created_at, counterparty_org_id")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (links ?? []).map((l) => l.counterparty_org_id);
    if (ids.length === 0) return { counterparties: [] };

    const { data: orgs, error: orgsErr } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, name, legal_name, tax_id, types, address_city, address_country",
      )
      .in("id", ids);
    if (orgsErr) throw new Error(orgsErr.message);
    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o] as const));

    return {
      counterparties: (links ?? []).map((l) => ({
        link_id: l.id,
        created_at: l.created_at,
        organization: orgMap.get(l.counterparty_org_id) ?? null,
      })),
    };
  });

/**
 * Usuwa link kontrahenta.
 */
export const removeCounterpartyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ linkId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("counterparty_links")
      .delete()
      .eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
