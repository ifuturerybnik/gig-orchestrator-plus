// Zaproszenia do organizacji — akceptacja / odrzucenie / lookup po tokenie.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TokenSchema = z.object({ token: z.string().min(8).max(128) });

// Publiczny lookup po tokenie (UI strony akceptacji przed/po zalogowaniu).
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((input) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: inv, error } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, status, expires_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return { invitation: null as null };
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, types")
      .eq("id", inv.organization_id)
      .maybeSingle();
    return {
      invitation: {
        id: inv.id,
        email: inv.email,
        status: inv.status as string,
        expires_at: inv.expires_at as string,
        organization: org ? { id: org.id, name: org.name, types: org.types } : null,
      },
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: inv, error } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, status, expires_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") throw new Error("Invitation already processed");
    if (new Date(inv.expires_at as string) < new Date()) {
      throw new Error("Invitation expired");
    }

    // Sprawdź czy email zaproszenia zgadza się z bieżącym userem.
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = (u?.user?.email ?? "").toLowerCase().trim();
    if (userEmail !== String(inv.email).toLowerCase().trim()) {
      throw new Error("Email mismatch");
    }

    // Dodaj jako członek (idempotent).
    const { data: existing } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", inv.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      const { error: memErr } = await supabaseAdmin
        .from("organization_members")
        .insert({
          organization_id: inv.organization_id,
          user_id: userId,
          role: "member",
        });
      if (memErr) throw new Error(memErr.message);
    }

    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    // Oznacz powiązane powiadomienia jako przeczytane.
    await supabaseAdmin
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("kind", "organization_invitation")
      .contains("payload", { invitation_id: inv.id });

    return { ok: true, organizationId: inv.organization_id as string };
  });

export const declineInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: inv } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    if (inv.status !== "pending") return { ok: true };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = (u?.user?.email ?? "").toLowerCase().trim();
    if (userEmail !== String(inv.email).toLowerCase().trim()) {
      throw new Error("Email mismatch");
    }
    await supabaseAdmin
      .from("organization_invitations")
      .update({ status: "declined" })
      .eq("id", inv.id);
    await supabaseAdmin
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("kind", "organization_invitation")
      .contains("payload", { invitation_id: inv.id });
    return { ok: true };
  });

// Lista oczekujących zaproszeń dla zalogowanego usera (po jego adresie email).
export const listMyPendingInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = (u?.user?.email ?? "").toLowerCase().trim();
    if (!email) return { invitations: [] as Array<any> };
    const { data: invs, error } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, token, email, status, expires_at, organization_id, created_at")
      .eq("status", "pending")
      .ilike("email", email)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const orgIds = Array.from(new Set((invs ?? []).map((i: any) => i.organization_id)));
    let orgsMap = new Map<string, { id: string; name: string }>();
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      orgsMap = new Map((orgs ?? []).map((o: any) => [o.id, o]));
    }
    const now = Date.now();
    return {
      invitations: (invs ?? [])
        .filter((i: any) => new Date(i.expires_at).getTime() > now)
        .map((i: any) => ({
          id: i.id,
          token: i.token,
          expires_at: i.expires_at,
          organization: orgsMap.get(i.organization_id) ?? null,
        })),
    };
  });
