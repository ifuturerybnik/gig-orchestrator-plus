import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Zapisuje zgody akceptowane przy rejestracji.
 *
 * Wywoływane bezpośrednio po `supabase.auth.signUp` — w tym momencie user
 * może jeszcze nie mieć aktywnej sesji (jeśli włączone email confirm),
 * dlatego używamy admin clienta. Zabezpieczenie:
 *  - user_id musi istnieć w auth.users
 *  - nie wolno nadpisać istniejących zgód (idempotentne — działa raz na konto)
 */
export const recordSignupConsents = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        terms_version: z.string().min(1).max(40),
        privacy_version: z.string().min(1).max(40),
        marketing_granted: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Walidacja: user musi istnieć
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.user_id)
      .maybeSingle();
    if (userErr) throw new Error(userErr.message);
    if (!userRow) throw new Error("User not found");

    // 2. Idempotencja: jeśli już są zgody, kończymy bez błędu
    const { count, error: countErr } = await supabaseAdmin
      .from("user_consents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user_id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) return { ok: true, skipped: true as const };

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const rows = [
      {
        user_id: data.user_id,
        consent_type: "terms",
        version: data.terms_version,
        granted: true,
        ip_address: ip,
        user_agent: userAgent,
      },
      {
        user_id: data.user_id,
        consent_type: "privacy",
        version: data.privacy_version,
        granted: true,
        ip_address: ip,
        user_agent: userAgent,
      },
      {
        user_id: data.user_id,
        consent_type: "marketing",
        version: data.privacy_version,
        granted: data.marketing_granted,
        ip_address: ip,
        user_agent: userAgent,
      },
    ];

    const { error } = await supabaseAdmin.from("user_consents").insert(rows);
    if (error) throw new Error(error.message);

    // Skopiuj migawkę zgody marketingowej na profil (dla łatwego filtrowania)
    if (data.marketing_granted) {
      await supabaseAdmin
        .from("profiles")
        .update({ marketing_consent: true })
        .eq("id", data.user_id);
    }

    return { ok: true, skipped: false as const };
  });
