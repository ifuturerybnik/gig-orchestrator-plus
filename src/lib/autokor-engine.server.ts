// SERVER-ONLY. Silnik autokorespondencji:
//  - generateRecipients: rozwija filtry kampanii do listy {email,name,kind,id}
//  - prepareBodyWithTracking: dokleja pixel + przerabia <a href> na trackowane
//  - dispatchPending: bierze batch wiadomości pending dla kampanii, wysyła przez
//    mail-proxy, aktualizuje status, dodaje pixel/linki tracking.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTemplate } from "./email-template-vars";
import { callMailProxy } from "./mail-proxy.server";
import { randomUUID, createHash } from "crypto";

interface Filtry {
  zrodlo?: string[];
  typy?: string[];
  tagi?: string[];
  kraje?: string[];
  miasta?: string[];
  gatunki?: string[];
  kontrahenci_ids?: string[];
  wyklucz_rezygnacje?: boolean;
  wyklucz_odbicia?: boolean;
}

export interface RecipientRow {
  email: string;
  name: string | null;
  kind: "contact" | "counterparty";
  id: string;
  extra?: Record<string, unknown>;
}

function getOrigin(): string {
  return (process.env.APP_PUBLIC_URL || process.env.SITE_URL || "").replace(/\/+$/, "");
}

function makeToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function generateRecipientsForKampania(
  kampaniaId: string,
): Promise<RecipientRow[]> {
  const { data: k } = await supabaseAdmin
    .from("autokorespondencje")
    .select("organization_id, filtry, created_by")
    .eq("id", kampaniaId)
    .maybeSingle();
  if (!k) throw new Error("Kampania not found");
  const orgId = k.organization_id as string;
  const createdBy = k.created_by as string;
  const f = (k.filtry ?? {}) as Filtry;

  const zrodlo = new Set(f.zrodlo ?? ["org_contacts"]);
  const typy = new Set(f.typy ?? ["person", "company", "artist"]);
  const tagi = f.tagi ?? [];
  const kraje = (f.kraje ?? []).map((x) => x.toUpperCase());
  const miasta = (f.miasta ?? []).map((x) => x.toLowerCase());
  const gatunki = f.gatunki ?? [];

  const out: RecipientRow[] = [];

  // Kontakty
  const contactScopes: Array<{ kind: "user" | "org" }> = [];
  if (zrodlo.has("user_contacts")) contactScopes.push({ kind: "user" });
  if (zrodlo.has("org_contacts")) contactScopes.push({ kind: "org" });

  for (const scope of contactScopes) {
    let q = supabaseAdmin
      .from("contacts")
      .select("id, kind, email, display_name, country_code, city, tags, genres")
      .not("email", "is", null);

    if (scope.kind === "user") {
      q = q.eq("owner_user_id", createdBy).is("organization_id", null);
    } else {
      q = q.eq("organization_id", orgId);
    }
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);

    for (const c of (rows ?? []) as Array<Record<string, unknown>>) {
      if (!typy.has(String(c.kind))) continue;
      if (tagi.length && !tagi.some((t) => Array.isArray(c.tags) && (c.tags as string[]).includes(t))) continue;
      if (kraje.length && !kraje.includes(String(c.country_code ?? "").toUpperCase())) continue;
      if (miasta.length && !miasta.includes(String(c.city ?? "").toLowerCase())) continue;
      if (gatunki.length) {
        const g = Array.isArray(c.genres) ? (c.genres as string[]) : [];
        if (!gatunki.some((x) => g.includes(x))) continue;
      }
      const email = String(c.email ?? "").trim().toLowerCase();
      if (!email) continue;
      out.push({
        email,
        name: (c.display_name as string) ?? null,
        kind: "contact",
        id: c.id as string,
      });
    }
  }

  // Kontrahenci (organizations powiązane via counterparty_links jako owner_org)
  if (zrodlo.has("org_counterparties")) {
    const { data: links } = await supabaseAdmin
      .from("counterparty_links")
      .select("counterparty_org_id")
      .eq("owner_kind", "organization")
      .eq("owner_org_id", orgId);
    let ids = (links ?? []).map((l) => l.counterparty_org_id as string);
    if (f.kontrahenci_ids?.length) {
      const allow = new Set(f.kontrahenci_ids);
      ids = ids.filter((x) => allow.has(x));
    }
    if (ids.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id, name, contact_email, address_country, address_city")
        .in("id", ids);
      for (const o of (orgs ?? []) as Array<Record<string, unknown>>) {
        const email = String(o.contact_email ?? "").trim().toLowerCase();
        if (!email) continue;
        if (kraje.length && !kraje.includes(String(o.address_country ?? "").toUpperCase())) continue;
        if (miasta.length && !miasta.includes(String(o.address_city ?? "").toLowerCase())) continue;
        out.push({
          email,
          name: (o.name as string) ?? null,
          kind: "counterparty",
          id: o.id as string,
        });
      }
    }
  }

  // Wykluczenia
  const excludeEmails = new Set<string>();
  if (f.wyklucz_rezygnacje !== false) {
    const { data: r } = await supabaseAdmin
      .from("email_rezygnacje")
      .select("email")
      .eq("organization_id", orgId);
    for (const row of r ?? []) excludeEmails.add(String(row.email).toLowerCase());
  }
  if (f.wyklucz_odbicia !== false) {
    const { data: o } = await supabaseAdmin
      .from("email_odbicia")
      .select("email")
      .eq("organization_id", orgId);
    for (const row of o ?? []) excludeEmails.add(String(row.email).toLowerCase());
  }

  // Dedup by email + filter excluded
  const seen = new Set<string>();
  return out.filter((r) => {
    if (excludeEmails.has(r.email)) return false;
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}

export async function ensureRecipientsGenerated(kampaniaId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", kampaniaId);
  if ((count ?? 0) > 0) return count ?? 0;

  const recipients = await generateRecipientsForKampania(kampaniaId);
  if (recipients.length === 0) return 0;

  const rows = recipients.map((r) => ({
    kampania_id: kampaniaId,
    recipient_email: r.email,
    recipient_name: r.name,
    recipient_kind: r.kind,
    recipient_id: r.id,
    status: "pending" as const,
    unsubscribe_token: makeToken(),
  }));

  // chunk insert
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabaseAdmin
      .from("autokorespondencje_wiadomosci")
      .insert(chunk);
    if (error) throw new Error(error.message);
  }
  await supabaseAdmin
    .from("autokorespondencje")
    .update({ total_odbiorcow: rows.length, updated_at: new Date().toISOString() })
    .eq("id", kampaniaId);
  return rows.length;
}

function rewriteLinksAndPixel(
  html: string,
  kampaniaId: string,
  wiadomoscId: string,
  recipientEmail: string,
  origin: string,
): string {
  let body = html || "";
  // przepisz <a href="X"> na trackowany link
  body = body.replace(/<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (_m, pre, q, url, post) => {
    if (/^(mailto:|tel:|#)/i.test(url)) return `<a${pre}href=${q}${url}${q}${post}>`;
    const token = createHash("sha256").update(`${wiadomoscId}|${url}`).digest("hex").slice(0, 24);
    const tracked = `${origin}/api/public/email-track-click?k=${kampaniaId}&m=${wiadomoscId}&t=${token}&u=${encodeURIComponent(url)}`;
    return `<a${pre}href=${q}${tracked}${q}${post}>`;
  });
  // pixel otwarcia
  const pixel = `<img src="${origin}/api/public/email-track-open?k=${kampaniaId}&m=${wiadomoscId}" width="1" height="1" alt="" style="display:none;border:0;outline:none;">`;
  body += pixel;
  return body;
}

function addUnsubscribeFooter(html: string, token: string, origin: string, lang: string): string {
  const url = `${origin}/api/public/email-unsubscribe?t=${token}`;
  const txt = lang === "en"
    ? `If you no longer want to receive these messages, you can <a href="${url}" target="_blank" rel="noopener">unsubscribe</a>.`
    : `Jeżeli nie chcesz już otrzymywać tych wiadomości, możesz się <a href="${url}" target="_blank" rel="noopener">wypisać</a>.`;
  return `${html}<hr style="margin-top:32px;border:none;border-top:1px solid #ddd;"><div style="font-size:11px;color:#888;margin-top:8px;">${txt}</div>`;
}

export async function dispatchPendingForKampania(
  kampaniaId: string,
  maxToSend: number,
): Promise<{ sent: number; failed: number }> {
  const { data: k } = await supabaseAdmin
    .from("autokorespondencje")
    .select("id, status, skrzynka_id, organization_id, temat, body_html")
    .eq("id", kampaniaId)
    .maybeSingle();
  if (!k) return { sent: 0, failed: 0 };
  if (k.status !== "running") return { sent: 0, failed: 0 };

  const { data: pending } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id, recipient_email, recipient_name, unsubscribe_token")
    .eq("kampania_id", kampaniaId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(maxToSend);

  const origin = getOrigin();
  let sent = 0;
  let failed = 0;

  for (const w of pending ?? []) {
    try {
      const ctx = {
        kontakt: { email: w.recipient_email, imie: w.recipient_name ?? "" },
        kontrahent: { nazwa: w.recipient_name ?? "" },
        organizacja: { id: k.organization_id },
        data: { dzisiaj: new Date().toLocaleDateString("pl-PL") },
      };
      const subjectRendered = renderTemplate(String(k.temat ?? ""), ctx);
      let bodyRendered = renderTemplate(String(k.body_html ?? ""), ctx);
      bodyRendered = rewriteLinksAndPixel(
        bodyRendered,
        kampaniaId,
        String(w.id),
        String(w.recipient_email),
        origin,
      );
      bodyRendered = addUnsubscribeFooter(bodyRendered, String(w.unsubscribe_token), origin, "pl");

      await callMailProxy("send", {
        skrzynka_id: k.skrzynka_id,
        to: [{ email: w.recipient_email, name: w.recipient_name }],
        subject: subjectRendered,
        html: bodyRendered,
      });
      await supabaseAdmin
        .from("autokorespondencje_wiadomosci")
        .update({
          status: "sent",
          wyslano_at: new Date().toISOString(),
          temat_rendered: subjectRendered,
          body_html_rendered: bodyRendered,
        })
        .eq("id", w.id);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("autokorespondencje_wiadomosci")
        .update({ status: "failed", blad_opis: msg.slice(0, 500) })
        .eq("id", w.id);
      failed++;
    }
  }

  // jeśli już nic nie ma — mark done
  const { count } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", kampaniaId)
    .eq("status", "pending");
  if ((count ?? 0) === 0) {
    await supabaseAdmin
      .from("autokorespondencje")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", kampaniaId);
  }
  return { sent, failed };
}

export function isWithinSchedule(
  godzinyOd: string,
  godzinyDo: string,
  dniTygodnia: number[],
  tz: string,
): boolean {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const dow = dayMap[weekdayShort] ?? 1;
  if (!dniTygodnia.includes(dow)) return false;
  const cur = `${hh}:${mm}`;
  return cur >= godzinyOd.slice(0, 5) && cur <= godzinyDo.slice(0, 5);
}
