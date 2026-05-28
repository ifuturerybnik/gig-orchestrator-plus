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
 * Dodaje istniejącą zarejestrowaną organizację jako kontrahenta:
 *   - zalogowanego usera (domyślnie), lub
 *   - wskazanej organizacji (gdy podane `ownerOrgId` — user musi być członkiem).
 */
export const addCounterpartyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        counterpartyOrgId: z.string().uuid(),
        ownerOrgId: z.string().uuid().optional(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cp, error: cpErr } = await supabase
      .from("organizations")
      .select("id, is_shared, status")
      .eq("id", data.counterpartyOrgId)
      .maybeSingle();
    if (cpErr) throw new Error(cpErr.message);
    if (!cp || !cp.is_shared || cp.status !== "approved") {
      throw new Error("Wybrana organizacja nie jest dostępna jako kontrahent.");
    }

    const insertRow = data.ownerOrgId
      ? {
          owner_kind: "organization" as const,
          owner_org_id: data.ownerOrgId,
          counterparty_org_id: data.counterpartyOrgId,
          note: data.note ?? null,
          created_by: userId,
        }
      : {
          owner_kind: "user" as const,
          owner_user_id: userId,
          counterparty_org_id: data.counterpartyOrgId,
          note: data.note ?? null,
          created_by: userId,
        };

    const { data: row, error } = await supabase
      .from("counterparty_links")
      .insert(insertRow as never)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          data.ownerOrgId
            ? "Ta organizacja ma już tego kontrahenta na liście."
            : "Masz już tego kontrahenta na swojej liście.",
        );
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
        "id, name, legal_name, tax_id, types, artist_kind, address_postal_code, address_city, address_street, address_building_no, address_country, is_shared",
      )
      .in("id", ids);
    if (orgsErr) throw new Error(orgsErr.message);
    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o] as const));

    // Org-shares: linki owner_kind='organization' do tych samych counterparty,
    // ograniczone do organizacji, których user jest członkiem.
    const { data: myMems } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const myOrgIds = (myMems ?? []).map(
      (m: { organization_id: string }) => m.organization_id,
    );
    const sharedMap = new Map<string, { id: string; name: string }[]>();
    if (myOrgIds.length > 0) {
      const { data: orgLinks } = await supabase
        .from("counterparty_links")
        .select("counterparty_org_id, owner_org_id")
        .eq("owner_kind", "organization")
        .in("counterparty_org_id", ids)
        .in("owner_org_id", myOrgIds);
      const { data: ownerOrgs } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .in("id", myOrgIds);
      const ownerNameMap = new Map(
        (ownerOrgs ?? []).map((o) => [o.id as string, o.name as string]),
      );
      for (const l of (orgLinks ?? []) as Array<{
        counterparty_org_id: string;
        owner_org_id: string;
      }>) {
        const arr = sharedMap.get(l.counterparty_org_id) ?? [];
        const name = ownerNameMap.get(l.owner_org_id);
        if (name) arr.push({ id: l.owner_org_id, name });
        sharedMap.set(l.counterparty_org_id, arr);
      }
    }

    return {
      counterparties: (links ?? []).map((l) => ({
        link_id: l.id,
        created_at: l.created_at,
        organization: orgMap.get(l.counterparty_org_id) ?? null,
        shared_to_orgs: sharedMap.get(l.counterparty_org_id) ?? [],
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

/**
 * Pobiera pełne dane kontrahenta z listy zalogowanego usera lub organizacji,
 * której user jest członkiem.
 * canEdit = true tylko jeśli to prywatny wpis (is_shared=false) utworzony przez tego usera.
 */
export const getCounterpartyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        linkId: z.string().uuid(),
        ownerOrgId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: link, error: linkErr } = await supabase
      .from("counterparty_links")
      .select("id, counterparty_org_id, owner_kind, owner_user_id, owner_org_id, note")
      .eq("id", data.linkId)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("Not found");

    if (data.ownerOrgId) {
      if (link.owner_kind !== "organization" || link.owner_org_id !== data.ownerOrgId) {
        throw new Error("Not found");
      }
    } else {
      if (link.owner_kind !== "user" || link.owner_user_id !== userId) {
        throw new Error("Not found");
      }
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, name, types, artist_kind, genres, description, tax_id, address_country, address_postal_code, address_city, address_street, address_building_no, is_shared, status, created_by",
      )
      .eq("id", link.counterparty_org_id)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Not found");

    const canEdit = !org.is_shared && org.created_by === userId;
    return { link: { id: link.id, note: link.note }, organization: org, canEdit };
  });

/**
 * Edycja prywatnego kontrahenta. Zarejestrowane (is_shared=true) są tylko do odczytu.
 */
export const updateMyCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        linkId: z.string().uuid(),
        ownerOrgId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(200),
        types: z.array(OrgTypeEnum).min(1).max(ORG_TYPES.length),
        description: optStr(2000),
        artist_kind: ArtistKindEnum.optional().nullable(),
        genres: z.array(GenreEnum).max(1).optional(),
        tax_id: optStr(40),
        address_country: optStr(120),
        address_postal_code: optStr(20),
        address_city: optStr(120),
        address_street: optStr(200),
        address_building_no: optStr(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: link } = await supabase
      .from("counterparty_links")
      .select("id, counterparty_org_id, owner_kind, owner_user_id, owner_org_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link) throw new Error("Not found");
    if (data.ownerOrgId) {
      if (link.owner_kind !== "organization" || link.owner_org_id !== data.ownerOrgId) {
        throw new Error("Not found");
      }
    } else {
      if (link.owner_kind !== "user" || link.owner_user_id !== userId) {
        throw new Error("Not found");
      }
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, is_shared, created_by")
      .eq("id", link.counterparty_org_id)
      .maybeSingle();
    if (!org) throw new Error("Not found");
    if (org.is_shared || org.created_by !== userId) {
      throw new Error(
        "Tego kontrahenta nie można edytować — jest zarejestrowany w bazie współdzielonej.",
      );
    }

    const isArtist = data.types.includes("artist");
    const hasCompanyType = data.types.some((t) => t !== "artist");

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        name: data.name,
        types: data.types,
        description: data.description,
        artist_kind: isArtist ? data.artist_kind ?? null : null,
        genres: isArtist ? data.genres ?? [] : [],
        legal_name: hasCompanyType ? data.name : null,
        tax_id: hasCompanyType && data.tax_id ? normalizeNip(data.tax_id) : null,
        address_country: hasCompanyType ? data.address_country : null,
        address_postal_code: hasCompanyType ? data.address_postal_code : null,
        address_city: hasCompanyType ? data.address_city : null,
        address_street: hasCompanyType ? data.address_street : null,
        address_building_no: hasCompanyType ? data.address_building_no : null,
      })
      .eq("id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lista kontrahentów wskazanej organizacji (user musi być członkiem).
 */
export const listOrgCounterparties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Walidacja członkostwa (RLS i tak ograniczy, ale daje jasny błąd)
    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!mem) throw new Error("Brak dostępu do tej organizacji.");

    const { data: links, error } = await supabase
      .from("counterparty_links")
      .select("id, created_at, counterparty_org_id")
      .eq("owner_kind", "organization")
      .eq("owner_org_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (links ?? []).map((l) => l.counterparty_org_id);
    if (ids.length === 0) return { counterparties: [] };

    const { data: orgs, error: orgsErr } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, name, legal_name, tax_id, types, artist_kind, address_postal_code, address_city, address_street, address_building_no, address_country, is_shared",
      )
      .in("id", ids);
    if (orgsErr) throw new Error(orgsErr.message);
    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o] as const));

    return {
      counterparties: (links ?? []).map((l) => ({
        link_id: l.id,
        created_at: l.created_at,
        organization: orgMap.get(l.counterparty_org_id) ?? null,
        shared_to_orgs: [] as { id: string; name: string }[],
      })),
    };
  });

/**
 * Tworzy nową organizację jako kontrahenta (status = 'pending', is_shared = true)
 * i jednocześnie dodaje link do listy kontrahentów zalogowanego usera.
 * Administrator aplikacji widzi wszystkie pola w panelu zatwierdzeń.
 */
export const createCounterpartyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ownerOrgId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(200),
        types: z.array(OrgTypeEnum).min(1).max(ORG_TYPES.length),
        description: optStr(2000),
        artist_kind: ArtistKindEnum.optional().nullable(),
        genres: z.array(GenreEnum).max(1).optional(),
        tax_id: optStr(40),
        address_country: optStr(120),
        address_postal_code: optStr(20),
        address_city: optStr(120),
        address_street: optStr(200),
        address_building_no: optStr(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isArtist = data.types.includes("artist");
    const hasCompanyType = data.types.some((t) => t !== "artist");

    const normalized = normalizeOrgName(data.name);
    const { data: sharedDupe } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("is_shared", true)
      .eq("status", "approved")
      .eq("name_normalized", normalized)
      .limit(1)
      .maybeSingle();
    if (sharedDupe) {
      throw new Error(
        "Organizacja o takiej nazwie już istnieje w bazie współdzielonej. Dodaj ją z listy wyników.",
      );
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        types: data.types,
        name: data.name,
        description: data.description,
        artist_kind: isArtist ? data.artist_kind ?? null : null,
        genres: isArtist ? data.genres ?? [] : [],
        legal_name: hasCompanyType ? data.name : null,
        tax_id: hasCompanyType && data.tax_id ? normalizeNip(data.tax_id) : null,
        address_country: hasCompanyType ? data.address_country : null,
        address_postal_code: hasCompanyType ? data.address_postal_code : null,
        address_city: hasCompanyType ? data.address_city : null,
        address_street: hasCompanyType ? data.address_street : null,
        address_building_no: hasCompanyType ? data.address_building_no : null,
        is_shared: false,
        status: "approved",
        created_by: userId,
      })
      .select("id")
      .single();
    if (orgErr) throw new Error(orgErr.message);

    await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", org.id)
      .eq("user_id", userId);

    const linkRow = data.ownerOrgId
      ? {
          owner_kind: "organization" as const,
          owner_org_id: data.ownerOrgId,
          counterparty_org_id: org.id,
          created_by: userId,
        }
      : {
          owner_kind: "user" as const,
          owner_user_id: userId,
          counterparty_org_id: org.id,
          created_by: userId,
        };
    const { error: linkErr } = await supabase
      .from("counterparty_links")
      .insert(linkRow as never);
    if (linkErr) throw new Error(linkErr.message);

    return { organizationId: org.id };
  });

