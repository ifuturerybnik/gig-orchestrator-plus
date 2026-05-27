import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(
  supabase: SupabaseClient,
  userId: string,
  requireSuper = false,
) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const list = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (requireSuper) {
    if (!list.includes("super_admin")) throw new Error("Forbidden");
  } else if (!list.some((r) => r === "super_admin" || r === "admin_staff")) {
    throw new Error("Forbidden");
  }
  return list;
}

/**
 * Lista administratorów (super_admin + admin_staff) z profilami i emailami.
 * Wymaga roli super_admin (zarządzanie adminami).
 */
export const listAdministrators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, true);

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["super_admin", "admin_staff"]);
    if (rolesErr) throw new Error(rolesErr.message);

    const map = new Map<string, { user_id: string; roles: string[] }>();
    for (const r of rolesRows ?? []) {
      const e = map.get(r.user_id) ?? { user_id: r.user_id, roles: [] };
      e.roles.push(r.role as string);
      map.set(r.user_id, e);
    }
    const ids = Array.from(map.keys());
    if (ids.length === 0) return { administrators: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ids);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p] as const));

    // Emaile — auth.admin
    const emails = new Map<string, string | null>();
    await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        emails.set(id, data.user?.email ?? null);
      }),
    );

    return {
      administrators: ids.map((id) => {
        const p = profileMap.get(id);
        const entry = map.get(id)!;
        return {
          user_id: id,
          email: emails.get(id) ?? null,
          first_name: p?.first_name ?? null,
          last_name: p?.last_name ?? null,
          roles: entry.roles,
        };
      }),
    };
  });

/**
 * Nadanie/odebranie roli administratora po emailu.
 * Tylko super_admin. Nie pozwala odebrać sobie super_admina.
 */
export const setAdministratorRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["super_admin", "admin_staff"]),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId, true);

    // Znajdź usera po emailu (paginacja auth.admin.listUsers)
    let target: { id: string; email: string | null } | null = null;
    for (let page = 1; page <= 10 && !target; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const found = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (found) target = { id: found.id, email: found.email ?? null };
      if (!list.users.length || list.users.length < 200) break;
    }
    if (!target) throw new Error("Nie znaleziono użytkownika o podanym emailu.");

    if (
      data.action === "revoke" &&
      target.id === userId &&
      data.role === "super_admin"
    ) {
      throw new Error("Nie możesz odebrać sobie roli super_admin.");
    }

    if (data.action === "grant") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: target.id, role: data.role });
      if (error && error.code !== "23505") throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", target.id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
