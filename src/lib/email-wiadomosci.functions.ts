// Server functions dla wiadomości email: dociąganie body, mark/delete, send.
// List wiadomości UI robi bezpośrednio przez supabase client (RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callMailProxy } from "./mail-proxy.server";

type ProxyBodyResponse = {
  body_html?: unknown;
  body_text?: unknown;
  html?: unknown;
  text?: unknown;
  message?: { body_html?: unknown; body_text?: unknown; html?: unknown; text?: unknown };
  wiadomosc?: { body_html?: unknown; body_text?: unknown; html?: unknown; text?: unknown };
};

function extractProxyBody(result: unknown): { body_html: string | null; body_text: string | null } {
  if (!result || typeof result !== "object") return { body_html: null, body_text: null };
  const data = result as ProxyBodyResponse;
  const nested = data.message ?? data.wiadomosc;
  const bodyHtml = data.body_html ?? data.html ?? nested?.body_html ?? nested?.html;
  const bodyText = data.body_text ?? data.text ?? nested?.body_text ?? nested?.text;
  return {
    body_html: typeof bodyHtml === "string" && bodyHtml.length > 0 ? bodyHtml : null,
    body_text: typeof bodyText === "string" && bodyText.length > 0 ? bodyText : null,
  };
}

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

    const proxyPayload = {
      wiadomosc_id: w.id,
      id: w.id,
      skrzynka_id: w.skrzynka_id,
      folder: w.folder,
      uid: w.uid,
      message_id: w.message_id,
    };

    const proxyResult = await callMailProxy("body", proxyPayload);
    const proxyBody = extractProxyBody(proxyResult);
    if (proxyBody.body_html || proxyBody.body_text) {
      await supabaseAdmin
        .from("email_wiadomosci")
        .update({ body_html: proxyBody.body_html, body_text: proxyBody.body_text })
        .eq("id", w.id);
      return { ok: true, cached: false, ...proxyBody };
    }

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

// Oznacz wiadomość jako SPAM (przenieś do folderu Spam/Junk na IMAP).
// Lokalnie też aktualizujemy folder na 'Spam' żeby UI natychmiast odpowiedział.
export const markSpamWiadomosc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ wiadomoscId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const w = await loadWiadomoscWithAccess(data.wiadomoscId, context.userId);
    let proxyOk = true;
    try {
      await callMailProxy("mark", { wiadomosc_id: data.wiadomoscId, action: "spam" });
    } catch (e) {
      proxyOk = false;
      console.warn("mail proxy spam failed, falling back to local move", e);
    }
    if (!proxyOk || w.folder !== "Spam") {
      await supabaseAdmin
        .from("email_wiadomosci")
        .update({ folder: "Spam" })
        .eq("id", data.wiadomoscId);
    }
    return { ok: true, proxyOk };
  });

// Działania zbiorowe — delete / spam / read / unread na liście wiadomości.
export const bulkActionWiadomosci = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        action: z.enum(["delete", "spam", "read", "unread"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of data.ids) {
      try {
        const w = await loadWiadomoscWithAccess(id, context.userId);
        if (data.action === "delete") {
          await callMailProxy("mark", { wiadomosc_id: id, action: "delete" });
        } else if (data.action === "spam") {
          try {
            await callMailProxy("mark", { wiadomosc_id: id, action: "spam" });
          } catch (e) {
            console.warn("bulk spam proxy fail, local-only", e);
          }
          if (w.folder !== "Spam") {
            await supabaseAdmin
              .from("email_wiadomosci")
              .update({ folder: "Spam" })
              .eq("id", id);
          }
        } else if (data.action === "read" || data.action === "unread") {
          await supabaseAdmin
            .from("email_wiadomosci")
            .update({ przeczytana: data.action === "read" })
            .eq("id", id);
        }
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : "error" });
      }
    }
    return { results, ok: results.every((r) => r.ok) };
  });
