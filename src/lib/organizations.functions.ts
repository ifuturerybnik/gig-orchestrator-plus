import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrgType = z.enum(["band", "stage_company", "event_company"]);

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        type: OrgType,
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        type: data.type,
        name: data.name,
        description: data.description ?? null,
        created_by: userId,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { organization: org };
  });

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("organizations")
      .select("id, type, name, status, description, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { organizations: data ?? [] };
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
      .select("id, type, name, description, created_at, created_by")
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

export const getOrganizationDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select(
        "id, type, name, description, status, created_at, created_by, approved_at, rejection_reason",
      )
      .eq("id", data.organizationId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Not found");

    const { data: members, error: memErr } = await supabase
      .from("organization_members")
      .select("id, user_id, role, joined_at")
      .eq("organization_id", data.organizationId)
      .order("joined_at", { ascending: true });
    if (memErr) throw new Error(memErr.message);

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
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
      members: membersEnriched,
      invitations,
      isOwner,
      isAdmin,
      canManage: isOwner || isAdmin,
    };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("organizations")
      .update({
        name: data.name,
        description: data.description ?? null,
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
