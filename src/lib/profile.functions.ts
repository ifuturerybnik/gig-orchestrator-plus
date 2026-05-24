import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROFILE_COLUMNS =
  "id, first_name, last_name, phone, preferred_language, user_kinds, address_street, address_city, address_postal_code, address_country";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, userEmail } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const USER_KIND = z.enum([
  "team_manager",
  "musician",
  "sound_engineer",
  "lighting_engineer",
  "visual_engineer",
  "driver",
  "stage_technician",
  "stage_company_owner",
  "event_company_owner",
  "concert_organizer",
]);

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        first_name: z.string().trim().min(1).max(120),
        last_name: z.string().trim().min(1).max(120),
        phone: optionalText(40),
        user_kinds: z.array(USER_KIND).max(20),
        address_street: optionalText(200),
        address_city: optionalText(120),
        address_postal_code: optionalText(20),
        address_country: optionalText(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        user_kinds: data.user_kinds,
        address_street: data.address_street,
        address_city: data.address_city,
        address_postal_code: data.address_postal_code,
        address_country: data.address_country,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

