// SERVER-ONLY. Silnik autokorespondencji v2 — port logiki z CRM Hub
// (autokorespondencja-generate + autokorespondencja-tick) zaadaptowany do
// Concertivo (audience: contacts | counterparties | manualne).
//
// Główne kroki:
//  1) generateRecipientsForKampania — rozwija filtry do listy odbiorców
//     z odpowiednim wykluczeniem (contacts.nie_wysylaj, odbicia, rezygnacje,
//     globalna lista wypisanych, dedup wewnątrz i między kampaniami).
//  2) ensureRecipientsGenerated — przydziela odbiorcom warianty wg pozycji
//     (jak w CRM Hub: ostatni wariant dostaje resztę), inserts do
//     autokorespondencje_wiadomosci ze statusem pending.
//  3) dispatchPendingForKampania — bierze batch pending, sprawdza limity
//     dzienne, losuje rotację z wariantu, renderuje treść z trackingiem
//     i stopką unsubscribe, woła mail-proxy, aktualizuje status. Auto-pauza
//     po N błędach w 15 min.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTemplate } from "./email-template-vars";
import { callMailProxy } from "./mail-proxy.server";
import { randomUUID, createHash } from "crypto";

interface Filtry {
  zrodlo?: string[]; // back-compat
  typy?: string[];
  tagi?: string[];
  kraje?: string[];
  miasta?: string[];
  gatunki?: string[];
  kontrahenci_ids?: string[];
  manualne_emails?: string[];
  wyklucz_rezygnacje?: boolean;
  wyklucz_odbicia?: boolean;
}

export interface RecipientRow {
  email: string;
  name: string | null;
  kind: "contact" | "counterparty" | "manual";
  id: string | null;
}

function getOrigin(): string {
  return (process.env.APP_PUBLIC_URL || process.env.SITE_URL || "").replace(/\/+$/, "");
}

function makeToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
}

async function tableExists(name: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(name).select("id", { head: true, count: "exact" }).limit(1);
  // PostgREST returns 42P01 / 404 when table missing
  return !error;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) GENEROWANIE LISTY ODBIORCÓW
// ─────────────────────────────────────────────────────────────────────────────
export async function generateRecipientsForKampania(
  kampaniaId: string,
): Promise<RecipientRow[]> {
  const { data: k } = await supabaseAdmin
    .from("autokorespondencje")
    .select("organization_id, audience, filtry, created_by")
    .eq("id", kampaniaId)
    .maybeSingle();
  if (!k) throw new Error("Kampania not found");
  const orgId = k.organization_id as string;
  const audience = String(k.audience ?? "contacts") as "contacts" | "counterparties" | "manualne";
  const f = (k.filtry ?? {}) as Filtry;

  let out: RecipientRow[] = [];

  // ── audience: contacts ──────────────────────────────────────────────────
  if (audience === "contacts") {
    if (await tableExists("contacts")) {
      const typy = new Set(f.typy ?? ["person", "company", "artist"]);
      const tagi = f.tagi ?? [];
      const kraje = (f.kraje ?? []).map((x) => x.toUpperCase());
      const miasta = (f.miasta ?? []).map((x) => x.toLowerCase());

      const { data: rows } = await supabaseAdmin
        .from("contacts")
        .select("id, kind, email, display_name, country_code, city, tags, nie_wysylaj_autokorespondencji")
        .eq("organization_id", orgId)
        .not("email", "is", null)
        .limit(10000);
      for (const c of (rows ?? []) as Array<Record<string, unknown>>) {
        if (c.nie_wysylaj_autokorespondencji === true) continue;
        if (!typy.has(String(c.kind))) continue;
        if (tagi.length && !tagi.some((t) => Array.isArray(c.tags) && (c.tags as string[]).includes(t))) continue;
        if (kraje.length && !kraje.includes(String(c.country_code ?? "").toUpperCase())) continue;
        if (miasta.length && !miasta.includes(String(c.city ?? "").toLowerCase())) continue;
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
  }

  // ── audience: counterparties ────────────────────────────────────────────
  if (audience === "counterparties") {
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
      const kraje = (f.kraje ?? []).map((x) => x.toUpperCase());
      const miasta = (f.miasta ?? []).map((x) => x.toLowerCase());
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

  // ── audience: manualne ──────────────────────────────────────────────────
  if (audience === "manualne") {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set<string>();
    for (const raw of f.manualne_emails ?? []) {
      const e = String(raw).trim().toLowerCase();
      if (!e || !re.test(e) || seen.has(e)) continue;
      seen.add(e);
      out.push({ email: e, name: null, kind: "manual", id: null });
    }
  }

  if (out.length === 0) return [];

  // ── Wykluczenia: rezygnacje + odbicia (per org) ─────────────────────────
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

  // ── Wykluczenia: globalna lista wypisanych ──────────────────────────────
  {
    const { data: w } = await supabaseAdmin
      .from("autokorespondencje_wypisani")
      .select("email_norm");
    for (const row of w ?? []) excludeEmails.add(String(row.email_norm));
  }

  // ── Dedup po emailu + filter excluded ───────────────────────────────────
  const seen = new Set<string>();
  out = out.filter((r) => {
    if (excludeEmails.has(r.email)) return false;
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  // ── Dedup: wyklucz adresy aktywne w INNYCH kampaniach (running/scheduled,
  //    pending/sending) — żeby nie zalewać tej samej osoby z dwóch frontów ─
  if (out.length) {
    const emails = out.map((r) => r.email);
    const { data: actv } = await supabaseAdmin
      .from("autokorespondencje_wiadomosci")
      .select("recipient_email, kampania_id, autokorespondencje!inner(id, status)")
      .neq("kampania_id", kampaniaId)
      .in("recipient_email", emails)
      .in("status", ["pending", "sending"]);
    const dupes = new Set<string>();
    for (const r of (actv ?? []) as Array<Record<string, unknown>>) {
      const kStatus = (r.autokorespondencje as { status?: string } | null)?.status;
      if (kStatus === "running" || kStatus === "scheduled") {
        dupes.add(String(r.recipient_email).toLowerCase());
      }
    }
    out = out.filter((r) => !dupes.has(r.email));
  }

  // ── Dedup: wyklucz adresy już WYSŁANE/W TRAKCIE w TEJ kampanii ──────────
  if (out.length) {
    const emails = out.map((r) => r.email);
    const { data: been } = await supabaseAdmin
      .from("autokorespondencje_wiadomosci")
      .select("recipient_email")
      .eq("kampania_id", kampaniaId)
      .in("status", ["sent", "sending"])
      .in("recipient_email", emails);
    const had = new Set((been ?? []).map((r) => String(r.recipient_email).toLowerCase()));
    out = out.filter((r) => !had.has(r.email));
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ZAPIS odbiorców do tabeli wiadomości + przydział wariantów
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureRecipientsGenerated(kampaniaId: string): Promise<number> {
  // Skasuj poprzednie pending/skipped (regeneracja). Pozostawiamy sent/sending/failed.
  await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .delete()
    .eq("kampania_id", kampaniaId)
    .in("status", ["pending", "skipped"]);

  const recipients = await generateRecipientsForKampania(kampaniaId);
  if (recipients.length === 0) {
    await supabaseAdmin
      .from("autokorespondencje")
      .update({ total_odbiorcow: 0, updated_at: new Date().toISOString() })
      .eq("id", kampaniaId);
    return 0;
  }

  // Pobierz warianty
  const { data: war } = await supabaseAdmin
    .from("autokorespondencje_warianty")
    .select("id, pozycja")
    .eq("kampania_id", kampaniaId)
    .order("pozycja");
  const warianty = (war ?? []) as Array<{ id: string; pozycja: number }>;

  // Przydział równomierny — round-robin (proste, deterministyczne dla MVP).
  // CRM Hub robi per-variant filter; tu wszyscy odbiorcy są po globalnych filtrach,
  // a warianty to A/B test — round-robin daje równy split.
  const rows = recipients.map((r, idx) => {
    const wariantId = warianty.length > 0 ? warianty[idx % warianty.length].id : null;
    return {
      kampania_id: kampaniaId,
      wariant_id: wariantId,
      recipient_email: r.email,
      recipient_name: r.name,
      recipient_kind: r.kind === "manual" ? null : r.kind,
      recipient_id: r.id,
      status: "pending" as const,
      unsubscribe_token: makeToken(),
    };
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// 3) RENDER: tracking links + open pixel + unsubscribe footer
// ─────────────────────────────────────────────────────────────────────────────
function rewriteLinksAndPixel(
  html: string,
  kampaniaId: string,
  wiadomoscId: string,
  origin: string,
  openTracking: boolean,
): string {
  let body = html || "";
  body = body.replace(/<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (_m, pre, q, url, post) => {
    if (/^(mailto:|tel:|#)/i.test(url)) return `<a${pre}href=${q}${url}${q}${post}>`;
    if (url.includes("/api/public/email-")) return `<a${pre}href=${q}${url}${q}${post}>`;
    const token = createHash("sha256").update(`${wiadomoscId}|${url}`).digest("hex").slice(0, 24);
    const tracked = `${origin}/api/public/email-track-click?k=${kampaniaId}&m=${wiadomoscId}&t=${token}&u=${encodeURIComponent(url)}`;
    return `<a${pre}href=${q}${tracked}${q}${post}>`;
  });
  if (openTracking) {
    body += `<img src="${origin}/api/public/email-track-open?k=${kampaniaId}&m=${wiadomoscId}" width="1" height="1" alt="" style="display:none;border:0;outline:none;">`;
  }
  return body;
}

function addUnsubscribeFooter(html: string, token: string, origin: string, lang: string): string {
  const url = `${origin}/api/public/email-unsubscribe?t=${token}`;
  const txt = lang === "en"
    ? `If you no longer want to receive these messages, you can <a href="${url}" target="_blank" rel="noopener">unsubscribe</a>.`
    : `Jeżeli nie chcesz już otrzymywać tych wiadomości, możesz się <a href="${url}" target="_blank" rel="noopener">wypisać</a>.`;
  return `${html}<hr style="margin-top:32px;border:none;border-top:1px solid #ddd;"><div style="font-size:11px;color:#888;margin-top:8px;">${txt}</div>`;
}

/** Wybiera rotację z wariantu (random pomiędzy temat/body głównym a rotacje_json). */
function pickRotation(
  variant: { temat: string; body_html: string; rotacje_json: Array<{ temat: string; body_html: string }> },
): { temat: string; body_html: string } {
  const pool: Array<{ temat: string; body_html: string }> = [{ temat: variant.temat, body_html: variant.body_html }];
  for (const r of variant.rotacje_json ?? []) {
    if ((r.temat || "").trim() || (r.body_html || "").trim()) pool.push(r);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) WYSYŁKA wiadomości pending dla kampanii
// ─────────────────────────────────────────────────────────────────────────────
export async function dispatchPendingForKampania(
  kampaniaId: string,
  maxToSend: number,
): Promise<{ sent: number; failed: number; deferred: number; autoPaused: number }> {
  const { data: k } = await supabaseAdmin
    .from("autokorespondencje")
    .select(
      "id, status, skrzynka_id, organization_id, temat, body_html, dzienny_limit, dzienny_limit_per_skrzynka, auto_pause_after_failures, dodaj_stopke_unsubscribe, open_tracking",
    )
    .eq("id", kampaniaId)
    .maybeSingle();
  if (!k) return { sent: 0, failed: 0, deferred: 0, autoPaused: 0 };
  if (k.status !== "running") return { sent: 0, failed: 0, deferred: 0, autoPaused: 0 };

  // Limity dzienne — odlicz ile już wysłano dziś (Europa/Warszawa)
  const todayCount = await dailyCount(kampaniaId);
  const limitGlobal = (k.dzienny_limit as number | null) ?? null;
  let remainGlobal = limitGlobal != null ? Math.max(0, limitGlobal - todayCount) : Infinity;
  const limitPerSkrz = (k.dzienny_limit_per_skrzynka as number | null) ?? 200;
  const skrzCount = await dailyCountPerSkrz(String(k.skrzynka_id));
  let remainSkrz = limitPerSkrz != null ? Math.max(0, limitPerSkrz - skrzCount) : Infinity;

  const limit = Math.min(maxToSend, Number.isFinite(remainGlobal) ? remainGlobal : maxToSend, Number.isFinite(remainSkrz) ? remainSkrz : maxToSend);
  let deferred = 0;
  if (limit <= 0) {
    return { sent: 0, failed: 0, deferred: maxToSend, autoPaused: 0 };
  }

  const { data: pending } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id, recipient_email, recipient_name, recipient_kind, unsubscribe_token, wariant_id")
    .eq("kampania_id", kampaniaId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!pending || pending.length === 0) {
    // Nic do wysłania — sprawdź czy kampania może przejść w 'done'
    await maybeMarkDone(kampaniaId);
    return { sent: 0, failed: 0, deferred: 0, autoPaused: 0 };
  }

  // Wczytaj warianty z rotacjami
  const varIds = Array.from(new Set(pending.map((m) => m.wariant_id as string | null).filter(Boolean) as string[]));
  const variantsMap = new Map<string, { temat: string; body_html: string; rotacje_json: Array<{ temat: string; body_html: string }> }>();
  if (varIds.length) {
    const { data: vars } = await supabaseAdmin
      .from("autokorespondencje_warianty")
      .select("id, temat, body_html, rotacje_json")
      .in("id", varIds);
    for (const v of vars ?? []) {
      variantsMap.set(v.id as string, {
        temat: String(v.temat ?? ""),
        body_html: String(v.body_html ?? ""),
        rotacje_json: (v.rotacje_json as Array<{ temat: string; body_html: string }>) ?? [],
      });
    }
  }

  // Pobierz nazwę org raz
  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("name, contact_email")
    .eq("id", k.organization_id as string)
    .maybeSingle();
  const orgNazwa = (orgRow?.name as string | null) ?? null;
  const orgEmail = (orgRow?.contact_email as string | null) ?? null;

  const origin = getOrigin();
  let sent = 0;
  let failed = 0;
  let autoPaused = 0;

  for (const w of pending) {
    // Atomowy claim: pending → sending (żeby kolejny tick nie podebrał)
    const { data: claimed } = await supabaseAdmin
      .from("autokorespondencje_wiadomosci")
      .update({ status: "sending" })
      .eq("id", w.id as string)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    // Wybierz treść: priorytet wariant → fallback kampania
    let baseTemat = String(k.temat ?? "");
    let baseBody = String(k.body_html ?? "");
    if (w.wariant_id) {
      const v = variantsMap.get(String(w.wariant_id));
      if (v) {
        const pick = pickRotation(v);
        baseTemat = pick.temat || baseTemat;
        baseBody = pick.body_html || baseBody;
      }
    }

    try {
      const ctx = {
        kontakt: { email: String(w.recipient_email), imie: w.recipient_name ?? "" },
        kontrahent: { nazwa: w.recipient_name ?? "" },
        organizacja: { nazwa: orgNazwa, email: orgEmail },
        data: { dzisiaj: new Date().toLocaleDateString("pl-PL") },
      };
      const subjectRendered = renderTemplate(baseTemat, ctx);
      let bodyRendered = renderTemplate(baseBody, ctx);
      bodyRendered = rewriteLinksAndPixel(
        bodyRendered,
        kampaniaId,
        String(w.id),
        origin,
        Boolean(k.open_tracking ?? true),
      );
      if (k.dodaj_stopke_unsubscribe !== false) {
        bodyRendered = addUnsubscribeFooter(bodyRendered, String(w.unsubscribe_token), origin, "pl");
      }

      await callMailProxy("send", {
        skrzynka_id: k.skrzynka_id,
        to: [{ email: w.recipient_email, name: w.recipient_name }],
        subject: subjectRendered,
        html: bodyRendered,
      });
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("autokorespondencje_wiadomosci")
        .update({
          status: "sent",
          sent_at: now,
          wyslano_at: now,
          temat_rendered: subjectRendered,
          body_html_rendered: bodyRendered,
        })
        .eq("id", w.id);
      sent++;
      remainGlobal--; remainSkrz--;
      if (remainGlobal <= 0 || remainSkrz <= 0) { deferred = pending.length - sent - failed; break; }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("autokorespondencje_wiadomosci")
        .update({ status: "failed", blad_opis: msg.slice(0, 500) })
        .eq("id", w.id);
      failed++;

      // ── Auto-pauza po N kolejnych błędach w 15 min ──
      const threshold = (k.auto_pause_after_failures as number | null) ?? 5;
      if (threshold > 0) {
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("autokorespondencje_wiadomosci")
          .select("id", { count: "exact", head: true })
          .eq("kampania_id", kampaniaId)
          .eq("status", "failed")
          .gte("updated_at", since);
        if ((count ?? 0) >= threshold) {
          await supabaseAdmin
            .from("autokorespondencje")
            .update({ status: "paused", auto_paused_reason: `Auto-pauza: ${count} błędów w ostatnich 15 min` })
            .eq("id", kampaniaId)
            .eq("status", "running");
          autoPaused++;
          break;
        }
      }
    }
  }

  await maybeMarkDone(kampaniaId);
  return { sent, failed, deferred, autoPaused };
}

async function dailyCount(kampaniaId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", kampaniaId)
    .eq("status", "sent")
    .gte("sent_at", `${today}T00:00:00Z`);
  return count ?? 0;
}

async function dailyCountPerSkrz(skrzynkaId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  // Liczymy wszystkie wysłane dziś z tej skrzynki przez WSZYSTKIE kampanie
  const { data: ks } = await supabaseAdmin
    .from("autokorespondencje")
    .select("id")
    .eq("skrzynka_id", skrzynkaId);
  const ids = (ks ?? []).map((k) => k.id as string);
  if (ids.length === 0) return 0;
  const { count } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id", { count: "exact", head: true })
    .in("kampania_id", ids)
    .eq("status", "sent")
    .gte("sent_at", `${today}T00:00:00Z`);
  return count ?? 0;
}

async function maybeMarkDone(kampaniaId: string): Promise<void> {
  const { count } = await supabaseAdmin
    .from("autokorespondencje_wiadomosci")
    .select("id", { count: "exact", head: true })
    .eq("kampania_id", kampaniaId)
    .in("status", ["pending", "sending"]);
  if ((count ?? 0) === 0) {
    await supabaseAdmin
      .from("autokorespondencje")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", kampaniaId)
      .eq("status", "running");
  }
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
