import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadEffectivePerms } from "@/lib/organizations.functions";

export const PERFORMANCE_STATUSES = [
  "inquiry",
  "tentative",
  "confirmed",
  "confirmed_signing",
  "confirmed_signed",
] as const;
export type PerformanceStatus = (typeof PERFORMANCE_STATUSES)[number];

export const PERFORMANCE_VISIBILITIES = [
  "private",
  "members_date",
  "members_full",
  "public_date",
  "public_full",
] as const;
export type PerformanceVisibility = (typeof PERFORMANCE_VISIBILITIES)[number];

// Preset event kinds (slugs). Custom kinds are stored as the literal label.
export const PERFORMANCE_EVENT_KIND_PRESETS = [
  "concert",
  "tv_appearance",
  "radio_interview",
  "marketing",
  "cabaret",
  "other",
] as const;
export type PerformanceEventKindPreset = (typeof PERFORMANCE_EVENT_KIND_PRESETS)[number];

const CONFIRMED: PerformanceStatus[] = ["confirmed", "confirmed_signing", "confirmed_signed"];

async function assertCanEditEvents(
  supabase: Parameters<typeof loadEffectivePerms>[0],
  userId: string,
  organizationId: string,
) {
  const perms = await loadEffectivePerms(supabase, userId, organizationId);
  if (perms.isOrgAdmin) return;
  if (!perms.modules.includes("events") || perms.eventsMode !== "full") {
    throw new Error("forbidden: events module is read-only for this user");
  }
}

const createInput = z
  .object({
    organizationId: z.string().uuid(),
    performanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    performanceTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    status: z.enum(PERFORMANCE_STATUSES),
    visibility: z.enum(PERFORMANCE_VISIBILITIES),
    eventKind: z.string().trim().min(1).max(120),
    name: z.string().trim().max(255).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    street: z.string().trim().max(200).optional().nullable(),
    streetNumber: z.string().trim().max(40).optional().nullable(),
    googleMapsUrl: z
      .string()
      .trim()
      .max(2048)
      .url()
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    notes: z.string().trim().max(5000).optional().nullable(),
    contactIds: z.array(z.string().uuid()).max(100).default([]),
    counterpartyIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .superRefine((d, ctx) => {
    const confirmed = CONFIRMED.includes(d.status);
    const required = (v: unknown) =>
      v != null && typeof v === "string" && v.trim().length > 0;
    if (confirmed) {
      const fields = [
        ["name", d.name],
        ["city", d.city],
        ["postalCode", d.postalCode],
        ["street", d.street],
        ["streetNumber", d.streetNumber],
        ["performanceTime", d.performanceTime],
      ] as const;
      for (const [k, v] of fields) {
        if (!required(v))
          ctx.addIssue({
            code: "custom",
            path: [k],
            message: `${k} is required for confirmed status`,
          });
      }
    }
    if (d.visibility === "public_full" && !required(d.googleMapsUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["googleMapsUrl"],
        message: "googleMapsUrl is required for public_full visibility",
      });
    }
  });

export const createPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEditEvents(supabase, userId, data.organizationId);

    // If a custom kind (not in presets), record it in the dictionary for future use.
    const kind = data.eventKind.trim();
    const isPreset = (PERFORMANCE_EVENT_KIND_PRESETS as readonly string[]).includes(kind);
    if (!isPreset) {
      // Best-effort insert; ignore duplicate-key conflict (already present).
      try {
        await supabase
          .from("performance_event_kinds")
          .insert({ organization_id: data.organizationId, label: kind, created_by: userId });
      } catch {
        /* ignore */
      }
    }

    const { data: perf, error } = await supabase
      .from("performances")
      .insert({
        organization_id: data.organizationId,
        created_by: userId,
        performance_date: data.performanceDate,
        performance_time: data.performanceTime ? data.performanceTime : null,
        status: data.status,
        visibility: data.visibility,
        event_kind: kind,
        name: data.name?.trim() || null,
        city: data.city?.trim() || null,
        postal_code: data.postalCode?.trim() || null,
        street: data.street?.trim() || null,
        street_number: data.streetNumber?.trim() || null,
        google_maps_url: data.googleMapsUrl?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const rows: Array<{
      performance_id: string;
      contact_id: string | null;
      counterparty_id: string | null;
    }> = [];
    for (const id of data.contactIds)
      rows.push({ performance_id: perf.id, contact_id: id, counterparty_id: null });
    for (const id of data.counterpartyIds)
      rows.push({ performance_id: perf.id, contact_id: null, counterparty_id: id });

    if (rows.length > 0) {
      const { error: aErr } = await supabase
        .from("performance_assignments")
        .insert(rows);
      if (aErr) throw new Error(aErr.message);
    }

    return { id: perf.id };
  });

export const listPerformances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const perms = await loadEffectivePerms(supabase, userId, data.organizationId);
    const onlyConfirmed =
      !perms.isOrgAdmin &&
      perms.modules.includes("events") &&
      perms.eventsMode === "view_confirmed_only";
    let q = supabase
      .from("performances")
      .select(
        "id, performance_date, performance_time, status, visibility, event_kind, name, city, postal_code, street, street_number, google_maps_url, notes, created_at",
      )
      .eq("organization_id", data.organizationId)
      .order("performance_date", { ascending: false })
      .limit(500);
    if (onlyConfirmed) q = q.in("status", CONFIRMED);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { items: [] };

    const { data: assigns, error: aErr } = await supabase
      .from("performance_assignments")
      .select("id, performance_id, contact_id, counterparty_id")
      .in("performance_id", ids);
    if (aErr) throw new Error(aErr.message);

    const contactIds = Array.from(
      new Set((assigns ?? []).map((a) => a.contact_id).filter(Boolean)),
    ) as string[];
    const cpIds = Array.from(
      new Set((assigns ?? []).map((a) => a.counterparty_id).filter(Boolean)),
    ) as string[];

    const [contactsRes, cpsRes] = await Promise.all([
      contactIds.length
        ? supabase
            .from("contacts")
            .select("id, display_name")
            .in("id", contactIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string }[], error: null }),
      cpIds.length
        ? supabaseAdmin
            .from("organizations")
            .select("id, name")
            .in("id", cpIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    ]);
    if (contactsRes.error) throw new Error(contactsRes.error.message);
    if (cpsRes.error) throw new Error(cpsRes.error.message);
    const cmap = new Map((contactsRes.data ?? []).map((c) => [c.id, c.display_name]));
    const omap = new Map((cpsRes.data ?? []).map((o) => [o.id, o.name]));

    const grouped = new Map<
      string,
      { contacts: { id: string; name: string }[]; counterparties: { id: string; name: string }[] }
    >();
    for (const a of assigns ?? []) {
      const g = grouped.get(a.performance_id) ?? { contacts: [], counterparties: [] };
      if (a.contact_id)
        g.contacts.push({ id: a.contact_id, name: cmap.get(a.contact_id) ?? "—" });
      if (a.counterparty_id)
        g.counterparties.push({
          id: a.counterparty_id,
          name: omap.get(a.counterparty_id) ?? "—",
        });
      grouped.set(a.performance_id, g);
    }

    return {
      items: (rows ?? []).map((r) => ({
        ...r,
        assignments: grouped.get(r.id) ?? { contacts: [], counterparties: [] },
      })),
    };
  });

export const listPerformanceEventKinds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("performance_event_kinds")
      .select("id, label")
      .eq("organization_id", data.organizationId)
      .order("label", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const updateInput = z
  .object({
    performanceId: z.string().uuid(),
    organizationId: z.string().uuid(),
    performanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(PERFORMANCE_STATUSES),
    visibility: z.enum(PERFORMANCE_VISIBILITIES),
    eventKind: z.string().trim().min(1).max(120),
    name: z.string().trim().max(255).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    street: z.string().trim().max(200).optional().nullable(),
    streetNumber: z.string().trim().max(40).optional().nullable(),
    googleMapsUrl: z
      .string()
      .trim()
      .max(2048)
      .url()
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    notes: z.string().trim().max(5000).optional().nullable(),
    contactIds: z.array(z.string().uuid()).max(100).default([]),
    counterpartyIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .superRefine((d, ctx) => {
    const confirmed = CONFIRMED.includes(d.status);
    const required = (v: unknown) =>
      v != null && typeof v === "string" && v.trim().length > 0;
    if (confirmed) {
      const fields = [
        ["name", d.name],
        ["city", d.city],
        ["postalCode", d.postalCode],
        ["street", d.street],
        ["streetNumber", d.streetNumber],
      ] as const;
      for (const [k, v] of fields) {
        if (!required(v))
          ctx.addIssue({ code: "custom", path: [k], message: `${k} required` });
      }
    }
    if (d.visibility === "public_full" && !required(d.googleMapsUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["googleMapsUrl"],
        message: "googleMapsUrl required for public_full",
      });
    }
  });

export const updatePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEditEvents(supabase, userId, data.organizationId);



    const kind = data.eventKind.trim();
    const isPreset = (PERFORMANCE_EVENT_KIND_PRESETS as readonly string[]).includes(kind);
    if (!isPreset) {
      try {
        await supabase
          .from("performance_event_kinds")
          .insert({ organization_id: data.organizationId, label: kind, created_by: userId });
      } catch {
        /* ignore */
      }
    }

    const { error } = await supabase
      .from("performances")
      .update({
        performance_date: data.performanceDate,
        status: data.status,
        visibility: data.visibility,
        event_kind: kind,
        name: data.name?.trim() || null,
        city: data.city?.trim() || null,
        postal_code: data.postalCode?.trim() || null,
        street: data.street?.trim() || null,
        street_number: data.streetNumber?.trim() || null,
        google_maps_url: data.googleMapsUrl?.trim() || null,
        notes: data.notes?.trim() || null,
      })
      .eq("id", data.performanceId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    // Replace assignments (simple strategy)
    const { error: delErr } = await supabase
      .from("performance_assignments")
      .delete()
      .eq("performance_id", data.performanceId);
    if (delErr) throw new Error(delErr.message);

    const rows: Array<{
      performance_id: string;
      contact_id: string | null;
      counterparty_id: string | null;
    }> = [];
    for (const id of data.contactIds)
      rows.push({ performance_id: data.performanceId, contact_id: id, counterparty_id: null });
    for (const id of data.counterpartyIds)
      rows.push({ performance_id: data.performanceId, contact_id: null, counterparty_id: id });

    if (rows.length > 0) {
      const { error: aErr } = await supabase
        .from("performance_assignments")
        .insert(rows);
      if (aErr) throw new Error(aErr.message);
    }

    return { id: data.performanceId };
  });

export const findCounterpartyLinkForOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ownerOrgId: z.string().uuid(),
        counterpartyOrgId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: link, error } = await supabase
      .from("counterparty_links")
      .select("id")
      .eq("owner_kind", "organization")
      .eq("owner_org_id", data.ownerOrgId)
      .eq("counterparty_org_id", data.counterpartyOrgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { linkId: link?.id ?? null };
  });

export const deletePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        performanceId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanEditEvents(supabase, userId, data.organizationId);
    const { error } = await supabase
      .from("performances")
      .delete()
      .eq("id", data.performanceId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
