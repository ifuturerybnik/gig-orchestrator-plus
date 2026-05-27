// Sharing kontaktów i kontrahentów do moich organizacji.
// - kontrahenci: dodatkowe wpisy w counterparty_links z owner_kind='organization'
// - kontakty:    wpisy w contact_org_shares (warstwa widoczności nad contacts)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista moich organizacji (gdzie jestem członkiem) — do sekcji udostępniania.
 */
export const listMyOrganizationsForSharing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error: mErr } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const ids = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
    if (ids.length === 0) return { organizations: [] };

    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, types, is_shared")
      .in("id", ids)
      // pomijamy „prywatnych kontrahentów" usera (is_shared=false, brak członków)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    return {
      organizations: (orgs ?? []).map((o) => ({
        id: o.id as string,
        name: o.name as string,
      })),
    };
  });

// ---------- Kontrahenci ----------

export const getCounterpartyOrgShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ counterpartyOrgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // tylko org, w których user jest członkiem
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const myOrgIds = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
    if (myOrgIds.length === 0) return { orgIds: [] as string[] };

    const { data: links, error } = await supabase
      .from("counterparty_links")
      .select("owner_org_id")
      .eq("owner_kind", "organization")
      .eq("counterparty_org_id", data.counterpartyOrgId)
      .in("owner_org_id", myOrgIds);
    if (error) throw new Error(error.message);
    return {
      orgIds: (links ?? []).map((l: { owner_org_id: string }) => l.owner_org_id),
    };
  });

export const setCounterpartyOrgShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        counterpartyOrgId: z.string().uuid(),
        orgIds: z.array(z.string().uuid()).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const myOrgIds = new Set(
      (memberships ?? []).map((m: { organization_id: string }) => m.organization_id),
    );
    const targetIds = data.orgIds.filter((id) => myOrgIds.has(id));

    // Obecny stan (tylko w obrębie moich org)
    const { data: current, error: curErr } = await supabase
      .from("counterparty_links")
      .select("id, owner_org_id")
      .eq("owner_kind", "organization")
      .eq("counterparty_org_id", data.counterpartyOrgId)
      .in("owner_org_id", Array.from(myOrgIds.size > 0 ? myOrgIds : new Set([""])));
    if (curErr) throw new Error(curErr.message);

    const currentMap = new Map(
      (current ?? []).map((l: { id: string; owner_org_id: string }) => [l.owner_org_id, l.id] as const),
    );
    const toInsert = targetIds.filter((id) => !currentMap.has(id));
    const toDelete = (current ?? [])
      .filter((l: { owner_org_id: string }) => !targetIds.includes(l.owner_org_id))
      .map((l: { id: string }) => l.id);

    if (toInsert.length > 0) {
      const rows = toInsert.map((orgId) => ({
        owner_kind: "organization" as const,
        owner_org_id: orgId,
        counterparty_org_id: data.counterpartyOrgId,
        created_by: userId,
      }));
      const { error } = await supabase
        .from("counterparty_links")
        .insert(rows);
      // 23505 = duplicate; ignorujemy (race)
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("counterparty_links")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }
    return { ok: true, added: toInsert.length, removed: toDelete.length };
  });

// ---------- Kontakty ----------

export const getContactOrgShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ contactId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("contact_org_shares")
      .select("organization_id")
      .eq("contact_id", data.contactId);
    if (error) throw new Error(error.message);
    return {
      orgIds: (rows ?? []).map((r: { organization_id: string }) => r.organization_id),
    };
  });

export const setContactOrgShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contactId: z.string().uuid(),
        orgIds: z.array(z.string().uuid()).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    const myOrgIds = new Set(
      (memberships ?? []).map((m: { organization_id: string }) => m.organization_id),
    );
    const targetIds = data.orgIds.filter((id) => myOrgIds.has(id));

    const { data: current, error: curErr } = await supabase
      .from("contact_org_shares")
      .select("id, organization_id")
      .eq("contact_id", data.contactId);
    if (curErr) throw new Error(curErr.message);

    const currentMap = new Map(
      (current ?? []).map((r: { id: string; organization_id: string }) => [r.organization_id, r.id] as const),
    );
    const toInsert = targetIds.filter((id) => !currentMap.has(id));
    const toDelete = (current ?? [])
      .filter((r: { organization_id: string }) => !targetIds.includes(r.organization_id))
      .map((r: { id: string }) => r.id);

    if (toInsert.length > 0) {
      const rows = toInsert.map((orgId) => ({
        contact_id: data.contactId,
        organization_id: orgId,
        created_by: userId,
      }));
      const { error } = await supabase.from("contact_org_shares").insert(rows);
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("contact_org_shares")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }
    return { ok: true, added: toInsert.length, removed: toDelete.length };
  });
