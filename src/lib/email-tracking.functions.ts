// Server fns do zarządzania listami: rezygnacje, odbicia, kliknięcia.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureMember(userId: string, orgId: string) {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listRezygnacje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureMember(context.userId, data.organizationId);
    const { data: rows, error } = await supabaseAdmin
      .from("email_rezygnacje")
      .select("id, email, kampania_id, zgloszone_at")
      .eq("organization_id", data.organizationId)
      .order("zgloszone_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const listOdbicia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureMember(context.userId, data.organizationId);
    const { data: rows, error } = await supabaseAdmin
      .from("email_odbicia")
      .select("id, email, typ, powod, zgloszone_at")
      .eq("organization_id", data.organizationId)
      .order("zgloszone_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteRezygnacja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("email_rezygnacje")
      .select("organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    await ensureMember(context.userId, row.organization_id as string);
    const { error } = await supabaseAdmin.from("email_rezygnacje").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOdbicie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("email_odbicia")
      .select("organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    await ensureMember(context.userId, row.organization_id as string);
    const { error } = await supabaseAdmin.from("email_odbicia").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewKampaniaRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: k } = await supabaseAdmin
      .from("autokorespondencje")
      .select("organization_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!k) throw new Error("Not found");
    await ensureMember(context.userId, k.organization_id as string);
    const { generateRecipientsForKampania } = await import("./autokor-engine.server");
    const list = await generateRecipientsForKampania(data.id);
    return { total: list.length, sample: list.slice(0, 50) };
  });
