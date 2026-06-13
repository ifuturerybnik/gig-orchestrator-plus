// Wysyłka pojedynczego maila przez mail-proxy /send.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMailProxy } from "./mail-proxy.server";

const recipientSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().max(160).optional(),
});

const sendInput = z.object({
  skrzynkaId: z.string().uuid(),
  to: z.array(recipientSchema).min(1).max(50),
  cc: z.array(recipientSchema).max(50).optional(),
  bcc: z.array(recipientSchema).max(50).optional(),
  subject: z.string().max(998).default(""),
  bodyHtml: z.string().max(2_000_000).default(""),
  inReplyTo: z.string().max(500).optional(),
  references: z.string().max(2000).optional(),
});

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: s } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id, typ, owner_user_id, organization_id, email, nazwa_wyswietlana")
      .eq("id", data.skrzynkaId)
      .maybeSingle();
    if (!s) throw new Error("Skrzynka not found");
    if (s.typ === "osobista" && s.owner_user_id !== userId) throw new Error("Forbidden");
    if (s.typ === "wspolna" && s.organization_id) {
      const { data: m } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("organization_id", s.organization_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!m) throw new Error("Forbidden");
    }

    const toEmails = data.to.map((r) => r.email);
    const ccEmails = (data.cc ?? []).map((r) => r.email);
    const bccEmails = (data.bcc ?? []).map((r) => r.email);

    // From: "Nazwa wyświetlana" <adres@…> — jeśli proxy obsługuje from_name/from,
    // skorzysta. Wysyłamy oba warianty (string + obiekt) dla kompatybilności.
    const displayName = (s.nazwa_wyswietlana ?? "").trim();
    const fromHeader = displayName
      ? `${displayName.replace(/"/g, "")} <${s.email}>`
      : s.email;

    const result = await callMailProxy<{ ok?: boolean; messageId?: string; error?: string }>(
      "send",
      {
        skrzynka_id: data.skrzynkaId,
        from: fromHeader,
        from_name: displayName || null,
        from_email: s.email,
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject: data.subject,
        html: data.bodyHtml,
        in_reply_to: data.inReplyTo ?? null,
        references: data.references ?? null,
      },
    );
    return { ok: true, messageId: result.messageId ?? null };
  });
