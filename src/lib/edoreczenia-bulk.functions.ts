// Dostęp organizacji do modułu "e-Doręczenia zbiorowe".
// Nadawany przez administratora (Administracja → e-Doręczenia → Dostęp).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BulkAccessOrg = {
  id: string;
  name: string;
  status: string;
  hasAccess: boolean;
  grantedAt: string | null;
};

async function assertAdmin(
  supabase: { from: (t: string) => any },
  userId: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const list = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!list.some((r) => r === "super_admin" || r === "admin_staff")) {
    throw new Error("Brak uprawnień administratora");
  }
}

/** Lista wszystkich organizacji z flagą dostępu (admin). */
export const listBulkAccessOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, status")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: grants } = await supabaseAdmin
      .from("edoreczenia_bulk_access")
      .select("organization_id, granted_at");
    const map = new Map(
      ((grants ?? []) as Array<{ organization_id: string; granted_at: string }>).map(
        (g) => [g.organization_id, g.granted_at] as const,
      ),
    );

    const organizations: BulkAccessOrg[] = (
      (orgs ?? []) as Array<{ id: string; name: string; status: string }>
    ).map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      hasAccess: map.has(o.id),
      grantedAt: map.get(o.id) ?? null,
    }));

    return { organizations };
  });

/** Nadanie / odebranie dostępu organizacji (admin). */
export const setBulkAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("edoreczenia_bulk_access")
        .upsert(
          { organization_id: data.organizationId, granted_by: userId },
          { onConflict: "organization_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("edoreczenia_bulk_access")
        .delete()
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Czy dana organizacja ma dostęp do modułu zbiorowego (dla członków). */
export const getOrgBulkAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("edoreczenia_bulk_access")
      .select("organization_id")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    return { hasAccess: Boolean(row) };
  });
