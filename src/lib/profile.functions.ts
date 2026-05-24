import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, preferred_language, user_kinds")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roleList = (roles ?? []).map((r) => r.role as string);
    return {
      userId,
      email: userEmail,
      profile: profile ?? null,
      roles: roleList,
      isAdmin: roleList.includes("super_admin") || roleList.includes("admin_staff"),
    };
  });
