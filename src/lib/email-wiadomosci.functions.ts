// Server functions dla wiadomości email: dociąganie body, mark/delete, send.
// List wiadomości UI robi bezpośrednio przez supabase client (RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMailProxy } from "./mail-proxy.server";

async function loadWiadomoscWithAccess(wiadomoscId: string, userId: string) {
  const { data: w, error } = await supabaseAdmin
    .from("email_wiadomosci")
    .select("id, skrzynka_id, folder, uid, message_id, body_html, body_text")
    .eq("id", wiadomoscId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!w) throw new Error("Not found");

  const { data: s } = await supabaseAdmin
    .from("email_skrzynki")
    .select("id, typ, owner_user_id, organization_id")
    .eq("id", w.skrzynka_id)
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
  return w;
}

export const fetchWiadomoscBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ wiadomoscId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const w = await loadWiadomoscWithAccess(data.wiadomoscId, context.userId);
    if (w.body_html || w.body_text) {
      return { ok: true, cached: true, body_html: w.body_html, body_text: w.body_text };
    }
    await callMailProxy("body", { wiadomosc_id: w.id });
    const { data: refreshed, error } = await supabaseAdmin
      .from("email_wiadomosci")
      .select("body_html, body_text")
      .eq("id", w.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      ok: true,
      cached: false,
      body_html: refreshed?.body_html ?? null,
      body_text: refreshed?.body_text ?? null,
    };
  });

export const markWiadomosc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        wiadomoscId: z.string().uuid(),
        action: z.enum(["read", "unread", "star", "unstar", "delete-local"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await loadWiadomoscWithAccess(data.wiadomoscId, context.userId);
    if (data.action === "delete-local") {
      const { error } = await supabaseAdmin
        .from("email_wiadomosci")
        .delete()
        .eq("id", data.wiadomoscId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const patch: Record<string, boolean> = {};
    if (data.action === "read") patch.przeczytana = true;
    if (data.action === "unread") patch.przeczytana = false;
    if (data.action === "star") patch.oznaczona_gwiazdka = true;
    if (data.action === "unstar") patch.oznaczona_gwiazdka = false;
    const { error } = await supabaseAdmin
      .from("email_wiadomosci")
      .update(patch)
      .eq("id", data.wiadomoscId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWiadomoscRemote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ wiadomoscId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await loadWiadomoscWithAccess(data.wiadomoscId, context.userId);
    await callMailProxy("mark", { wiadomosc_id: data.wiadomoscId, action: "delete" });
    return { ok: true };
  });
