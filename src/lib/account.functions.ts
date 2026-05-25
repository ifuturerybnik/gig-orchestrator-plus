import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptPii } from "./crypto.server";

/**
 * RODO: prawo dostępu (art. 15) — eksport wszystkich danych użytkownika
 * w formacie JSON. PII deszyfrowane do plaintextu (user ma prawo je zobaczyć).
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;

    const [profileRes, rolesRes, consentsRes, membershipsRes, orgsCreatedRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role, created_at").eq("user_id", userId),
        supabase
          .from("user_consents")
          .select("consent_type, version, granted, ip_address, user_agent, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("organization_members")
          .select("organization_id, role, created_at")
          .eq("user_id", userId),
        supabase.from("organizations").select("id, name, type, status, created_at").eq("created_by", userId),
      ]);

    const profile = profileRes.data
      ? {
          ...profileRes.data,
          billing_pesel: decryptPii((profileRes.data as Record<string, unknown>).billing_pesel_enc as string | null),
          billing_bank_account: decryptPii(
            (profileRes.data as Record<string, unknown>).billing_bank_account_enc as string | null,
          ),
          billing_pesel_enc: undefined,
          billing_bank_account_enc: undefined,
        }
      : null;

    return {
      exported_at: new Date().toISOString(),
      account: { user_id: userId, email: userEmail },
      profile,
      roles: rolesRes.data ?? [],
      consents: consentsRes.data ?? [],
      organization_memberships: membershipsRes.data ?? [],
      organizations_created: orgsCreatedRes.data ?? [],
    };
  });

/**
 * RODO: prawo do bycia zapomnianym (art. 17). Trwale usuwa konto.
 *
 * Blokady:
 *  - użytkownik jest jedynym ownerem jakiejś organizacji → musi najpierw
 *    przekazać własność albo usunąć organizację.
 *
 * Co się dzieje przy usunięciu auth.users:
 *  - profiles, user_roles, user_consents, organization_members → CASCADE
 *  - organizations.created_by ma ON DELETE RESTRICT (stąd blokada powyżej)
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Znajdź organizacje gdzie user jest ownerem
    const { data: ownedOrgs, error: ownedErr } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, organizations:organization_id(name)")
      .eq("user_id", userId)
      .eq("role", "owner");
    if (ownedErr) throw new Error(ownedErr.message);

    const blockingOrgs: string[] = [];
    for (const row of ownedOrgs ?? []) {
      const orgId = row.organization_id as string;
      const { count, error } = await supabaseAdmin
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "owner");
      if (error) throw new Error(error.message);
      if ((count ?? 0) <= 1) {
        const orgName =
          ((row as Record<string, unknown>).organizations as { name?: string } | null)?.name ??
          orgId;
        blockingOrgs.push(orgName);
      }
    }
    if (blockingOrgs.length > 0) {
      throw new Error(
        `Nie można usunąć konta — jesteś jedynym właścicielem organizacji: ${blockingOrgs.join(", ")}. Przekaż własność lub usuń te organizacje przed usunięciem konta.`,
      );
    }

    // Trwałe usunięcie z auth.users → CASCADE czyści powiązane tabele.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
