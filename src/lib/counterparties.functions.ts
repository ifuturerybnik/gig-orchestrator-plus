import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeNip } from "@/lib/nip";

/**
 * Tura B — wyszukiwanie w bazie kontrahentów (organizacji współdzielonych).
 * Zwraca tylko zatwierdzone i is_shared = true, ograniczony zestaw kolumn.
 */
export const searchSharedOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nip: z.string().trim().max(40).optional(),
        name: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .refine((d) => Boolean(d.nip || (d.name && d.name.length >= 2)), {
        message: "Podaj NIP lub min. 2 znaki nazwy.",
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10;
    // używamy admin (BYPASS RLS) tylko żeby ujawnić publiczne kolumny — projekcja jest WYRAŹNA
    let query = supabaseAdmin
      .from("organizations")
      .select(
        "id, name, types, artist_kind, tax_id, legal_name, address_city, address_country, status, is_shared",
      )
      .eq("is_shared", true)
      .eq("status", "approved")
      .limit(limit);

    const ors: string[] = [];
    if (data.nip) {
      const nipNorm = normalizeNip(data.nip);
      if (nipNorm.length >= 6) ors.push(`tax_id.eq.${nipNorm}`);
    }
    if (data.name && data.name.length >= 2) {
      // ilike escape: usuwamy %, _ z inputu
      const safe = data.name.replace(/[%_]/g, " ").trim();
      ors.push(`name.ilike.%${safe}%`);
      ors.push(`legal_name.ilike.%${safe}%`);
    }
    if (ors.length === 0) return { matches: [] };
    query = query.or(ors.join(","));

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { matches: rows ?? [] };
  });

/**
 * Utwórz prośbę o dołączenie do istniejącej organizacji (claim).
 */
export const requestJoinOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        message: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Sprawdź czy już jest członkiem
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingMember) {
      throw new Error("Jesteś już członkiem tej organizacji.");
    }
    const { data: row, error } = await supabase
      .from("organization_join_requests")
      .insert({
        organization_id: data.organizationId,
        user_id: userId,
        message: data.message ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Już złożyłeś prośbę o dołączenie — czeka na decyzję.");
      }
      throw new Error(error.message);
    }
    return { request: row };
  });

/**
 * Lista próśb (admin).
 */
export const listJoinRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some(
      (r) => r.role === "super_admin" || r.role === "admin_staff",
    );
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("organization_join_requests")
      .select(
        "id, organization_id, user_id, message, status, created_at, organizations(id, name, types, tax_id)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

/**
 * Decyzja admina: approve → wstaw membership; reject → tylko zmień status.
 */
export const decideJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(input),
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

    const { data: req, error: reqErr } = await supabase
      .from("organization_join_requests")
      .select("id, organization_id, user_id, status")
      .eq("id", data.requestId)
      .single();
    if (reqErr) throw new Error(reqErr.message);
    if (req.status !== "pending") {
      throw new Error("Ta prośba została już rozpatrzona.");
    }

    if (data.decision === "approved") {
      // Dodaj członkostwo (idempotentnie)
      const { error: memErr } = await supabaseAdmin
        .from("organization_members")
        .upsert(
          {
            organization_id: req.organization_id,
            user_id: req.user_id,
            role: "member",
          },
          { onConflict: "organization_id,user_id" },
        );
      if (memErr) throw new Error(memErr.message);
    }

    const { error: updErr } = await supabase
      .from("organization_join_requests")
      .update({
        status: data.decision,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_reason: data.reason ?? null,
      })
      .eq("id", data.requestId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });
