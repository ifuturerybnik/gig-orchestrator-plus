import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TBL = "contact_counterparty_links";

/** Tworzy powiązanie kontakt ↔ kontrahent (scope user). */
export const linkContactToCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contactId: z.string().uuid(),
        counterpartyOrgId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Weryfikacja: kontakt należy do usera
    const { data: c, error: cErr } = await supabase
      .from("contacts")
      .select("id, owner_user_id, organization_id")
      .eq("id", data.contactId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c || c.owner_user_id !== userId || c.organization_id !== null) {
      throw new Error("Nie można powiązać tego kontaktu.");
    }

    // Weryfikacja: kontrahent znajduje się na liście usera
    const { data: link, error: linkErr } = await supabase
      .from("counterparty_links")
      .select("id")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId)
      .eq("counterparty_org_id", data.counterpartyOrgId)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link) throw new Error("Ten kontrahent nie znajduje się na Twojej liście.");

    const { data: row, error } = await supabase
      .from(TBL)
      .insert({
        contact_id: data.contactId,
        counterparty_org_id: data.counterpartyOrgId,
        owner_kind: "user",
        owner_user_id: userId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { id: null, alreadyLinked: true };
      }
      throw new Error(error.message);
    }
    return { id: row.id, alreadyLinked: false };
  });

export const unlinkContactCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ linkId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from(TBL).delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista kontaktów powiązanych z danym kontrahentem (z perspektywy zalogowanego usera). */
export const listLinkedContactsForCounterparty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ counterpartyOrgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from(TBL)
      .select("id, contact_id, created_at")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId)
      .eq("counterparty_org_id", data.counterpartyOrgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (links ?? []).map((l) => l.contact_id);
    if (ids.length === 0) return { items: [] };
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("id, display_name, email, phone")
      .in("id", ids);
    if (cErr) throw new Error(cErr.message);
    const map = new Map((contacts ?? []).map((c) => [c.id, c] as const));
    return {
      items: (links ?? []).map((l) => ({
        linkId: l.id,
        contact: map.get(l.contact_id) ?? null,
      })),
    };
  });

/** Lista kontrahentów powiązanych z danym kontaktem. */
export const listLinkedCounterpartiesForContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ contactId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from(TBL)
      .select("id, counterparty_org_id, created_at")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId)
      .eq("contact_id", data.contactId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (links ?? []).map((l) => l.counterparty_org_id);
    if (ids.length === 0) return { items: [] };
    const { data: orgs, error: oErr } = await supabaseAdmin
      .from("organizations")
      .select("id, name, tax_id, is_shared")
      .in("id", ids);
    if (oErr) throw new Error(oErr.message);
    const map = new Map((orgs ?? []).map((o) => [o.id, o] as const));
    return {
      items: (links ?? []).map((l) => ({
        linkId: l.id,
        organization: map.get(l.counterparty_org_id) ?? null,
      })),
    };
  });

/** Moje kontakty osobowe — do pickera w dialogu kontrahenta. */
export const listLinkableContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ search: z.string().trim().max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("contacts")
      .select("id, display_name, email, phone")
      .eq("owner_user_id", userId)
      .is("organization_id", null)
      .eq("kind", "person")
      .order("display_name", { ascending: true })
      .limit(50);
    if (data.search && data.search.length > 0) {
      q = q.ilike("display_name", `%${data.search}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Moi kontrahenci — do pickera w formularzu kontaktu. */
export const listLinkableCounterparties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ search: z.string().trim().max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from("counterparty_links")
      .select("counterparty_org_id")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    const ids = (links ?? []).map((l) => l.counterparty_org_id);
    if (ids.length === 0) return { items: [] };
    let q = supabaseAdmin
      .from("organizations")
      .select("id, name, tax_id, is_shared")
      .in("id", ids)
      .order("name", { ascending: true })
      .limit(100);
    if (data.search && data.search.length > 0) {
      q = q.ilike("name", `%${data.search}%`);
    }
    const { data: orgs, error: oErr } = await q;
    if (oErr) throw new Error(oErr.message);
    return { items: orgs ?? [] };
  });

/** Wszystkie powiązania kontakt↔kontrahent zalogowanego usera — do wskaźników w listach. */
export const listMyContactCounterpartyLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from(TBL)
      .select("contact_id, counterparty_org_id")
      .eq("owner_kind", "user")
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
