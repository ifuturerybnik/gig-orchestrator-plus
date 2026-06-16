// Core GUS REGON (BIR1.1) lookup logic — bezpiecznie używane z server fn
// (gus.functions.ts) i z workera (gus-scan-worker.server.ts).
// Throttle 1 req/s jest globalny dla procesu (module-level state).

import { readRuntimeSecret } from "@/lib/runtime-secrets.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GUS_PROD_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const GUS_TEST_URL = "https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const NS_ADDR = "http://www.w3.org/2005/08/addressing";
const NS_BIR = "http://CIS/BIR/PUBL/2014/07";
const NS_BIR_DATA = "http://CIS/BIR/PUBL/2014/07/DataContract";

const MIN_GAP_MS = 1000;
let lastSoapAt = 0;
let throttleChain: Promise<void> = Promise.resolve();
function throttleSoap(): Promise<void> {
  const next = throttleChain.then(async () => {
    const wait = Math.max(0, lastSoapAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSoapAt = Date.now();
  });
  throttleChain = next.catch(() => {});
  return next;
}

function envelope(gusUrl: string, action: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="${NS_ADDR}" xmlns:bir="${NS_BIR}">
  <soap:Header><wsa:To>${gusUrl}</wsa:To><wsa:Action>${action}</wsa:Action></soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

async function soapCall(gusUrl: string, action: string, body: string, sid?: string) {
  await throttleSoap();
  const headers: Record<string, string> = { "Content-Type": "application/soap+xml; charset=utf-8" };
  if (sid) headers["sid"] = sid;
  const r = await fetch(gusUrl, { method: "POST", headers, body: envelope(gusUrl, action, body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`GUS HTTP ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

async function resolveGusEndpoint(): Promise<{ url: string; label: string }> {
  const explicit = await readRuntimeSecret(["GUS_API_URL", "GUS_ENDPOINT", "EXT_GUS_API_URL", "EXT_GUS_ENDPOINT"]);
  if (explicit) return { url: explicit, label: "niestandardowe" };
  const env = (await readRuntimeSecret(["GUS_ENV", "EXT_GUS_ENV", "GUS_MODE", "EXT_GUS_MODE"]))?.toLowerCase();
  if (env === "test" || env === "testing" || env === "dev") return { url: GUS_TEST_URL, label: "testowe" };
  return { url: GUS_PROD_URL, label: "produkcyjne" };
}

function extractResult(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}
function decodeXml(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function parseDaneRows(innerXml: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const daneRe = /<dane>([\s\S]*?)<\/dane>/g;
  let m: RegExpExecArray | null;
  while ((m = daneRe.exec(innerXml)) !== null) {
    const row: Record<string, string> = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[1])) !== null) row[f[1]] = f[2].trim();
    out.push(row);
  }
  return out;
}

async function zaloguj(apiKey: string, gusUrl: string, label: string): Promise<string> {
  const body = `<bir:Zaloguj><bir:pKluczUzytkownika>${apiKey}</bir:pKluczUzytkownika></bir:Zaloguj>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/Zaloguj`, body);
  const sid = extractResult(xml, "ZalogujResult").trim();
  if (!sid) throw new Error(`GUS: nie udało się zalogować (pusty sid — środowisko ${label})`);
  return sid;
}

const RAPORTY: Record<string, { glowny: string; pkd: string; prefix: string }> = {
  P:  { glowny: "BIR11OsPrawna",                glowny2: "", pkd: "BIR11OsPrawnaPkd",                prefix: "praw_" } as never,
  LP: { glowny: "BIR11JednLokalnaOsPrawnej",    pkd: "BIR11JednLokalnaOsPrawnejPkd",                prefix: "lokpraw_" },
  F:  { glowny: "BIR11OsFizycznaDaneOgolne",    pkd: "BIR11OsFizycznaPkd",                          prefix: "fiz_" },
  LF: { glowny: "BIR11JednLokalnaOsFizycznej",  pkd: "BIR11JednLokalnaOsFizycznejPkd",              prefix: "lokfiz_" },
};

async function szukajPodmioty(identifier: { nip?: string; regon?: string; krs?: string }, sid: string, gusUrl: string) {
  let param = "";
  if (identifier.nip) param = `<dat:Nip>${identifier.nip}</dat:Nip>`;
  else if (identifier.regon) param = `<dat:Regon>${identifier.regon}</dat:Regon>`;
  else if (identifier.krs) param = `<dat:Krs>${identifier.krs}</dat:Krs>`;
  else throw new Error("Brak identyfikatora");
  const body = `<bir:DaneSzukajPodmioty><bir:pParametryWyszukiwania xmlns:dat="${NS_BIR_DATA}">${param}</bir:pParametryWyszukiwania></bir:DaneSzukajPodmioty>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/DaneSzukajPodmioty`, body, sid);
  return parseDaneRows(decodeXml(extractResult(xml, "DaneSzukajPodmiotyResult")));
}

async function pobierzPelnyRaport(regon: string, nazwaRaportu: string, sid: string, gusUrl: string) {
  const body = `<bir:DanePobierzPelnyRaport><bir:pRegon>${regon}</bir:pRegon><bir:pNazwaRaportu>${nazwaRaportu}</bir:pNazwaRaportu></bir:DanePobierzPelnyRaport>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/DanePobierzPelnyRaport`, body, sid);
  return parseDaneRows(decodeXml(extractResult(xml, "DanePobierzPelnyRaportResult")));
}

function extractFullData(rows: Record<string, string>[], prefix: string) {
  if (!rows.length) return null;
  const r = rows[0];
  const get = (s: string) => r[`${prefix}${s}`] || null;
  return {
    numer_w_rejestrze: get("numerWRejestrzeEwidencji"),
    powiat: get("adSiedzPowiat_Nazwa") || get("adSiedzPowiat") || null,
    gmina: get("adSiedzGmina_Nazwa") || get("adSiedzGmina") || null,
    forma_prawna: get("podstawowaFormaPrawna_Nazwa"),
  };
}

function normalize(row: Record<string, string>, pelny: Record<string, string | null> | null) {
  const ulica = row.Ulica || "";
  const numer = [row.NrNieruchomosci, row.NrLokalu].filter(Boolean).join("/");
  return {
    typ: row.Typ,
    nazwa: row.Nazwa || "",
    nip: row.Nip || "",
    regon: row.Regon || "",
    krs: row.KRS || "",
    adres: {
      ulica: ulica ? `${ulica} ${numer}`.trim() : numer,
      kod_pocztowy: row.KodPocztowy || "",
      miejscowosc: row.Miejscowosc || "",
      gmina: (pelny?.gmina as string) || row.Gmina || "",
      powiat: (pelny?.powiat as string) || row.Powiat || "",
      wojewodztwo: row.Wojewodztwo || "",
    },
    pelny,
  };
}

async function getSid(apiKey: string, gusUrl: string, label: string, forceNew = false): Promise<string> {
  if (!forceNew) {
    const { data: s } = await supabaseAdmin.from("gus_sesja").select("sid, utworzono").eq("id", 1).maybeSingle();
    if (s?.sid && s?.utworzono) {
      const age = (Date.now() - new Date(s.utworzono).getTime()) / 1000;
      if (age < 55 * 60) return s.sid;
    }
  }
  const sid = await zaloguj(apiKey, gusUrl, label);
  await supabaseAdmin.from("gus_sesja").upsert({ id: 1, sid, utworzono: new Date().toISOString() });
  return sid;
}

export type GusLookupInput = {
  nip?: string;
  regon?: string;
  krs?: string;
  scope?: "basic" | "full";
};

export type GusLookupResult = {
  source: "gus";
  scope: "basic" | "full";
  dane: ReturnType<typeof normalize> | null;
  raw?: Record<string, string>;
};

export async function gusLookupCore(input: GusLookupInput): Promise<GusLookupResult> {
  const apiKey = await readRuntimeSecret(["GUS_API_KEY", "EXT_GUS_API_KEY"]);
  if (!apiKey) throw new Error("Brak sekretu GUS_API_KEY na serwerze.");
  const endpoint = await resolveGusEndpoint();

  const zakres: "basic" | "full" = input.scope === "full" ? "full" : "basic";
  const nip = input.nip?.replace(/\D/g, "") || undefined;
  const regon = input.regon?.replace(/\D/g, "") || undefined;
  let krs = input.krs?.replace(/\D/g, "") || undefined;
  if (krs && krs.length > 0 && krs.length < 10) krs = krs.padStart(10, "0");
  const ident = { nip, regon, krs };
  if (!ident.nip && !ident.regon && !ident.krs) throw new Error("Podaj NIP, REGON lub KRS");

  let sid = await getSid(apiKey, endpoint.url, endpoint.label);
  let rows: Record<string, string>[];
  try {
    rows = await szukajPodmioty(ident, sid, endpoint.url);
  } catch {
    sid = await getSid(apiKey, endpoint.url, endpoint.label, true);
    rows = await szukajPodmioty(ident, sid, endpoint.url);
  }
  if (!rows.length) return { source: "gus", scope: zakres, dane: null };

  const baseRow = rows[0];
  let pelny: Record<string, string | null> | null = null;
  if (zakres === "full") {
    try {
      const config = RAPORTY[baseRow.Typ];
      if (config) {
        const pelnyRows = await pobierzPelnyRaport(baseRow.Regon, config.glowny, sid, endpoint.url);
        pelny = extractFullData(pelnyRows, config.prefix);
      }
    } catch {
      // ignore
    }
  }
  return { source: "gus", scope: zakres, dane: normalize(baseRow, pelny), raw: baseRow };
}
