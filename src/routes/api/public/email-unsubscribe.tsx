// Strona rezygnacji — GET pokazuje formularz, POST zapisuje rezygnację.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function page(body: string): Response {
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rezygnacja — Concertivo</title><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:64px auto;padding:24px;background:#fafafa;color:#222}.box{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:32px}.btn{background:#111;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}</style></head><body><div class="box">${body}</div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function findByToken(token: string) {
  const { data } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id, recipient_email, kampania_id, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!data) return null;
  const { data: k } = await supabaseAdmin
    .from("autokorespondencje")
    .select("organization_id, nazwa")
    .eq("id", data.kampania_id as string)
    .maybeSingle();
  return { ...data, kampania: k };
}

export const Route = createFileRoute("/api/public/email-unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t");
        if (!token) return page("<h2>Brak tokenu</h2>");
        const w = await findByToken(token);
        if (!w) return page("<h2>Link nieaktywny lub wygasł.</h2>");
        return page(`<h2>Wypisz się z wysyłki</h2><p>Adres: <strong>${escapeHtml(String(w.recipient_email))}</strong></p><form method="POST"><input type="hidden" name="t" value="${escapeHtml(token)}"><button class="btn" type="submit">Tak, wypisz mnie</button></form>`);
      },
      POST: async ({ request }) => {
        let token: string | null = null;
        const ct = request.headers.get("content-type") ?? "";
        if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
          const fd = await request.formData();
          token = (fd.get("t") as string | null) ?? null;
        } else if (ct.includes("application/json")) {
          const body = await request.json().catch(() => ({}));
          token = (body as { t?: string }).t ?? null;
        } else {
          token = new URL(request.url).searchParams.get("t");
        }
        if (!token) return page("<h2>Brak tokenu</h2>");
        const w = await findByToken(token);
        if (!w) return page("<h2>Link nieaktywny.</h2>");
        const orgId = (w.kampania as { organization_id?: string } | null)?.organization_id;
        const email = String(w.recipient_email).toLowerCase();
        if (orgId) {
          await supabaseAdmin
            .from("email_rezygnacje")
            .upsert(
              { organization_id: orgId, email, kampania_id: w.kampania_id },
              { onConflict: "organization_id,email" },
            );
        }
        await supabaseAdmin
          .from("autokorespondencje_wiadomosci")
          .update({ status: "unsubscribed" })
          .eq("id", w.id);
        return page(`<h2>Wypisano</h2><p>Adres <strong>${escapeHtml(email)}</strong> nie będzie już otrzymywać wiadomości z tej organizacji.</p>`);
      },
    },
  },
});
