import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MUSIC_GENRES } from "@/lib/genres";
import { ORG_TYPES, ARTIST_KINDS } from "@/lib/orgTypes";
import { normalizeNip } from "@/lib/nip";
import {
  CONFIGURABLE_MODULE_IDS,
  type BudgetPermissionMode,
  type OrgModuleId,
} from "@/lib/org-modules";

const ModuleIdEnum = z.enum(
  CONFIGURABLE_MODULE_IDS as unknown as [OrgModuleId, ...OrgModuleId[]],
);
const BudgetModeEnum = z.enum(["full", "unrealized_only"] as const);

async function isAppAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return ((roles ?? []) as Array<{ role: string }>).some(
    (r) => r.role === "super_admin" || r.role === "admin_staff",
  );
}

async function loadEffectivePerms(
  supabase: { from: (t: string) => any },
  userId: string,
  organizationId: string,
): Promise<{
  isOrgAdmin: boolean;
  modules: OrgModuleId[];
  budgetMode: BudgetPermissionMode;
}> {
  // owner?
  const { data: me } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (me?.role === "owner") {
    return { isOrgAdmin: true, modules: [], budgetMode: "full" };
  }
  // admin aplikacji?
  if (await isAppAdmin(supabase, userId)) {
    return { isOrgAdmin: true, modules: [], budgetMode: "full" };
  }
  if (!me) {
    // nie jest członkiem — brak dostępu (overview/profile traktowane jako alwaysVisible po stronie UI)
    return { isOrgAdmin: false, modules: [], budgetMode: "full" };
  }
  const { data: perm } = await supabase
    .from("organization_member_permissions")
    .select("is_org_admin, modules, budget_mode")
    .eq("member_id", me.id)
    .maybeSingle();
  if (!perm) {
    // kompatybilność wsteczna: brak wpisu = pełen dostęp
    return { isOrgAdmin: true, modules: [], budgetMode: "full" };
  }
  return {
    isOrgAdmin: Boolean(perm.is_org_admin),
    modules: Array.isArray(perm.modules) ? (perm.modules as OrgModuleId[]) : [],
    budgetMode: (perm.budget_mode as BudgetPermissionMode) ?? "full",
  };
}

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

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        types: z.array(OrgTypeEnum).min(1).max(ORG_TYPES.length),
        name: z.string().trim().min(2).max(200),
        description: optStr(2000),
        artist_kind: ArtistKindEnum.optional().nullable(),
        genres: z.array(GenreEnum).max(1).optional(),
        legal_name: optStr(200),
        tax_id: optStr(40),
        address_country: optStr(120),
        address_postal_code: optStr(20),
        address_city: optStr(120),
        address_street: optStr(200),
        address_building_no: optStr(40),
        is_shared: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const insertPayload: Record<string, unknown> = {
      types: data.types,
      name: data.name,
      description: data.description,
      artist_kind: data.artist_kind ?? null,
      genres: data.genres ?? [],
      legal_name: data.legal_name,
      tax_id: data.tax_id ? normalizeNip(data.tax_id) : null,
      address_country: data.address_country,
      address_postal_code: data.address_postal_code,
      address_city: data.address_city,
      address_street: data.address_street,
      address_building_no: data.address_building_no,
      is_shared: data.is_shared ?? true,
      created_by: userId,
      status: "pending",
    };
    const { data: org, error } = await supabase
      .from("organizations")
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { organization: org };
  });

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Czy admin aplikacji? Admin widzi wszystko.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "super_admin" || r.role === "admin_staff",
    );

    if (isAdmin) {
      // Admin nie powinien widzieć prywatnych kontrahentów userów na liście organizacji.
      // Wykluczamy każdą org, do której istnieje wpis w counterparty_links.
      const { data: allCpLinks } = await supabase
        .from("counterparty_links")
        .select("counterparty_org_id");
      const cpOrgIds = new Set(
        (allCpLinks ?? []).map((l: { counterparty_org_id: string }) => l.counterparty_org_id),
      );
      const { data, error } = await supabase
        .from("organizations")
        .select("id, types, artist_kind, name, status, description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return {
        organizations: (data ?? []).filter((o) => !cpOrgIds.has(o.id)),
        isAdmin: true,
      };
    }

    // Zwykły user: tylko org, których jest członkiem LUB twórcą,
    // ale BEZ tych, które ma jednocześnie na liście kontrahentów
    // (private counterparties — trigger handle_new_organization dodaje
    //  twórcę jako 'owner', więc trzeba je wykluczyć tutaj).
    const { data: memberships, error: memErr } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    if (memErr) throw new Error(memErr.message);
    const memberOrgIds = (memberships ?? []).map((m) => m.organization_id);

    const { data: cpLinks } = await supabase
      .from("counterparty_links")
      .select("counterparty_org_id")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId);
    const cpOrgIds = new Set(
      (cpLinks ?? []).map((l: { counterparty_org_id: string }) => l.counterparty_org_id),
    );

    const { data, error } = await supabase
      .from("organizations")
      .select("id, types, artist_kind, name, status, description, created_at, created_by")
      .or(
        memberOrgIds.length > 0
          ? `created_by.eq.${userId},id.in.(${memberOrgIds.join(",")})`
          : `created_by.eq.${userId}`,
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      organizations: (data ?? [])
        .filter((o) => !cpOrgIds.has(o.id))
        .map(({ created_by: _cb, ...rest }) => rest),
      isAdmin: false,
    };
  });

/**
 * Usunięcie organizacji — tylko administrator aplikacji.
 * Używa supabaseAdmin, więc omija RLS (i wykonuje kaskadowe DELETE wg FK).
 */
export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "super_admin" || r.role === "admin_staff",
    );
    if (!isAdmin) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const listPendingOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // RLS: only admins see everything; sanity-check via user_roles too.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) =>
      r.role === "super_admin" || r.role === "admin_staff",
    );
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("organizations")
      .select("id, types, artist_kind, name, description, created_at, created_by")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { organizations: data ?? [] };
  });

export const setOrganizationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        rejectionReason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("organizations")
      .update({
        status: data.status,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        rejection_reason: data.status === "rejected" ? data.rejectionReason ?? null : null,
      })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteUserToOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        email: z.string().trim().toLowerCase().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: invite, error } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: data.organizationId,
        email: data.email,
        invited_by: userId,
      })
      .select("id, email, token, expires_at")
      .single();
    if (error) throw new Error(error.message);
    // TODO: wysyłka maila z linkiem zapraszającym (osobny moduł).
    return { invitation: invite };
  });

const ORG_COLUMNS =
  "id, types, artist_kind, name, description, status, created_at, created_by, approved_at, rejection_reason, address_street, address_building_no, address_city, address_postal_code, address_country, genres, currency, legal_name, tax_id, registration_number, court_register_number, bank_account, bank_name, signatory_name, signatory_position, contact_email, contact_phone, website, is_shared";

export const getOrganizationDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select(ORG_COLUMNS)
      .eq("id", data.organizationId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Not found");

    // Autoryzacja: szczegóły org dostępne tylko dla członka / twórcy / admina aplikacji.
    // (RLS na organizations dopuszcza is_shared+approved dla wyszukiwarki kontrahentów,
    //  ale tu zwracamy pełne dane finansowe — wymagamy faktycznego dostępu.)
    const { data: myMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    const { data: rolesGate } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAppAdminGate = (rolesGate ?? []).some(
      (r) => r.role === "super_admin" || r.role === "admin_staff",
    );
    const isCreator = (org as { created_by?: string | null }).created_by === userId;
    if (!myMembership && !isAppAdminGate && !isCreator) {
      throw new Error("Forbidden");
    }

    const { data: members, error: memErr } = await supabase
      .from("organization_members")
      .select("id, user_id, role, joined_at")
      .eq("organization_id", data.organizationId)
      .order("joined_at", { ascending: true });
    if (memErr) throw new Error(memErr.message);


    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> };

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p] as const),
    );
    const membersEnriched = (members ?? []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) ?? null,
    }));

    const me = membersEnriched.find((m) => m.user_id === userId);
    const isOwner = me?.role === "owner";

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "super_admin" || r.role === "admin_staff",
    );

    // Uprawnienia poszczególnych członków (do wyświetlenia owneorowi/adminowi).
    const memberIds = membersEnriched.map((m) => m.id);
    let permsByMember = new Map<string, {
      is_org_admin: boolean;
      modules: OrgModuleId[];
      budget_mode: BudgetPermissionMode;
    }>();
    if (memberIds.length) {
      const { data: permRows } = await supabaseAdmin
        .from("organization_member_permissions")
        .select("member_id, is_org_admin, modules, budget_mode")
        .in("member_id", memberIds);
      permsByMember = new Map(
        ((permRows ?? []) as Array<{
          member_id: string;
          is_org_admin: boolean;
          modules: unknown;
          budget_mode: BudgetPermissionMode;
        }>).map((r) => [
          r.member_id,
          {
            is_org_admin: Boolean(r.is_org_admin),
            modules: Array.isArray(r.modules) ? (r.modules as OrgModuleId[]) : [],
            budget_mode: (r.budget_mode as BudgetPermissionMode) ?? "full",
          },
        ]),
      );
    }
    const membersWithPerms = membersEnriched.map((m) => ({
      ...m,
      permissions: permsByMember.get(m.id) ?? null,
    }));

    // Efektywne uprawnienia bieżącego usera.
    const myPermissions = await loadEffectivePerms(supabase, userId, data.organizationId);

    let invitations: Array<{
      id: string;
      email: string;
      status: string;
      expires_at: string;
      created_at: string;
    }> = [];
    if (isOwner || isAdmin) {
      const { data: invs } = await supabase
        .from("organization_invitations")
        .select("id, email, status, expires_at, created_at")
        .eq("organization_id", data.organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      invitations = invs ?? [];
    }

    return {
      organization: org,
      members: membersWithPerms,
      invitations,
      isOwner,
      isAdmin,
      canManage: isOwner || isAdmin,
      myPermissions,
    };
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        description: optionalText(2000),
        address_street: optionalText(200),
        address_city: optionalText(120),
        address_postal_code: optionalText(20),
        address_country: optionalText(120),
        genres: z.array(GenreEnum).max(20).optional(),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/)
          .optional(),
        legal_name: optionalText(200),
        tax_id: optionalText(40),
        registration_number: optionalText(40),
        court_register_number: optionalText(40),
        bank_account: optionalText(60),
        bank_name: optionalText(120),
        signatory_name: optionalText(200),
        signatory_position: optionalText(120),
        contact_email: z
          .string()
          .trim()
          .max(255)
          .optional()
          .transform((v) => (v && v.length > 0 ? v : null))
          .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v ?? ""), {
            message: "Invalid email",
          }),
        contact_phone: optionalText(40),
        website: optionalText(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organizations")
      .update({
        name: data.name,
        description: data.description,
        address_street: data.address_street,
        address_city: data.address_city,
        address_postal_code: data.address_postal_code,
        address_country: data.address_country,
        ...(data.genres !== undefined ? { genres: data.genres } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        legal_name: data.legal_name,
        tax_id: data.tax_id,
        registration_number: data.registration_number,
        court_register_number: data.court_register_number,
        bank_account: data.bank_account,
        bank_name: data.bank_name,
        signatory_name: data.signatory_name,
        signatory_position: data.signatory_position,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        website: data.website,
      })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const removeOrganizationMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ invitationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organization_invitations")
      .update({ status: "cancelled" })
      .eq("id", data.invitationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// BUDGET
// ============================================================================

const BudgetKind = z.enum(["income", "expense"]);

export const listBudgetEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entries, error } = await supabase
      .from("organization_budget_entries")
      .select(
        "id, organization_id, created_by, entry_date, description, kind, amount_gross, currency, category, completed, completed_by, completed_at, created_at",
      )
      .eq("organization_id", data.organizationId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(
        (entries ?? []).flatMap((e) =>
          [e.created_by, e.completed_by].filter(Boolean) as string[],
        ),
      ),
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> };
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p] as const),
    );

    return {
      entries: (entries ?? []).map((e) => ({
        ...e,
        amount_gross: Number(e.amount_gross),
        author: profileMap.get(e.created_by) ?? null,
        completed_author: e.completed_by ? profileMap.get(e.completed_by) ?? null : null,
      })),
    };
  });

export const createBudgetEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        entry_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        description: z.string().trim().min(1).max(500),
        kind: BudgetKind,
        amount_gross: z.number().nonnegative().max(99999999.99),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/),
        category: z
          .string()
          .trim()
          .max(80)
          .optional()
          .transform((v) => (v && v.length > 0 ? v : null)),
        completed: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error } = await supabase
      .from("organization_budget_entries")
      .insert({
        organization_id: data.organizationId,
        created_by: userId,
        entry_date: data.entry_date ?? new Date().toISOString().slice(0, 10),
        description: data.description,
        kind: data.kind,
        amount_gross: data.amount_gross,
        currency: data.currency,
        category: data.category ?? null,
        completed: data.completed ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry };
  });

export const setBudgetEntryCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entryId: z.string().uuid(),
        completed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error: readError } = await supabase
      .from("organization_budget_entries")
      .select("id")
      .eq("id", data.entryId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!entry) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("organization_budget_entries")
      .update({
        completed: data.completed,
        completed_by: data.completed ? userId : null,
        completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const deleteBudgetEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ entryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organization_budget_entries")
      .delete()
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// PLANNED EXPENSES (przyszłe wydatki / wpływy)
// ============================================================================

export const listPlannedExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entries, error } = await supabase
      .from("organization_planned_expenses")
      .select(
        "id, organization_id, created_by, entry_date, description, kind, planned_date, amount_gross, currency, category, completed, completed_by, completed_at, created_at",
      )
      .eq("organization_id", data.organizationId)
      .order("planned_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(
        (entries ?? []).flatMap((e) =>
          [e.created_by, e.completed_by].filter(Boolean) as string[],
        ),
      ),
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> };
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p] as const),
    );

    return {
      entries: (entries ?? []).map((e) => ({
        ...e,
        amount_gross: Number(e.amount_gross),
        author: profileMap.get(e.created_by) ?? null,
        completed_author: e.completed_by ? profileMap.get(e.completed_by) ?? null : null,
      })),
    };
  });

export const createPlannedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        description: z.string().trim().min(1).max(500),
        kind: BudgetKind,
        planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount_gross: z.number().nonnegative().max(99999999.99),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/),
        category: z
          .string()
          .trim()
          .max(80)
          .optional()
          .transform((v) => (v && v.length > 0 ? v : null)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error } = await supabase
      .from("organization_planned_expenses")
      .insert({
        organization_id: data.organizationId,
        created_by: userId,
        entry_date: new Date().toISOString().slice(0, 10),
        description: data.description,
        kind: data.kind,
        planned_date: data.planned_date,
        amount_gross: data.amount_gross,
        currency: data.currency,
        category: data.category ?? null,
        completed: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry };
  });


export const setPlannedExpenseCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entryId: z.string().uuid(),
        completed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: entry, error: readError } = await supabase
      .from("organization_planned_expenses")
      .select("id")
      .eq("id", data.entryId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!entry) throw new Error("Forbidden");

    const { error } = await supabaseAdmin
      .from("organization_planned_expenses")
      .update({
        completed: data.completed,
        completed_by: data.completed ? userId : null,
        completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlannedExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ entryId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organization_planned_expenses")
      .delete()
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
