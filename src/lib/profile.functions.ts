import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROFILE_COLUMNS =
  "id, first_name, last_name, phone, preferred_language, user_kinds, address_street, address_city, address_postal_code, address_country, settlement_form, settlement_employer_org_id, settlement_other_description, billing_company_name, billing_tax_id, billing_is_vat_payer, billing_bank_account, billing_pesel, billing_tax_office, billing_zus_title, billing_default_rate, billing_default_currency";

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
    .nullable()
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

const SETTLEMENT_FORM = z.enum([
  "employment",
  "business",
  "mandate_contract",
  "work_contract",
  "other",
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
        // Rozliczenia
        settlement_form: SETTLEMENT_FORM.nullable().optional(),
        settlement_employer_org_id: z.string().uuid().nullable().optional(),
        settlement_other_description: optionalText(500),
        billing_company_name: optionalText(200),
        billing_tax_id: optionalText(40),
        billing_is_vat_payer: z.boolean().nullable().optional(),
        billing_bank_account: optionalText(60),
        billing_pesel: optionalText(20),
        billing_tax_office: optionalText(200),
        billing_zus_title: optionalText(60),
        billing_default_rate: z.number().nonnegative().nullable().optional(),
        billing_default_currency: optionalText(8),
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
        settlement_form: data.settlement_form ?? null,
        settlement_employer_org_id:
          data.settlement_form === "employment"
            ? data.settlement_employer_org_id ?? null
            : null,
        settlement_other_description:
          data.settlement_form === "other" ? data.settlement_other_description : null,
        billing_company_name: data.billing_company_name,
        billing_tax_id: data.billing_tax_id,
        billing_is_vat_payer: data.billing_is_vat_payer ?? null,
        billing_bank_account: data.billing_bank_account,
        billing_pesel: data.billing_pesel,
        billing_tax_office: data.billing_tax_office,
        billing_zus_title: data.billing_zus_title,
        billing_default_rate: data.billing_default_rate ?? null,
        billing_default_currency: data.billing_default_currency,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
