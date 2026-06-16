import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readRuntimeSecret } from "@/lib/runtime-secrets.server";

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

function envelope(gusUrl: string, action: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="${NS_ADDR}" xmlns:bir="${NS_BIR}">
  <soap:Header>
    <wsa:To>${gusUrl}</wsa:To>
    <wsa:Action>${action}</wsa:Action>
  </soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

async function soapCall(gusUrl: string, action: string, body: string, sid?: string): Promise<string> {
  await throttleSoap();
  const headers: Record<string, string> = {
    "Content-Type": "application/soap+xml; charset=utf-8",
  };
  if (sid) headers["sid"] = sid;
  const r = await fetch(gusUrl, { method: "POST", headers, body: envelope(gusUrl, action, body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`GUS HTTP ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

async function resolveGusEndpoint(): Promise<{ url: string; label: string }> {
  const explicitUrl = await readRuntimeSecret(["GUS_API_URL", "GUS_ENDPOINT", "EXT_GUS_API_URL", "EXT_GUS_ENDPOINT"]);
  if (explicitUrl) return { url: explicitUrl, label: "niestandardowe" };

  const env = (await readRuntimeSecret(["GUS_ENV", "EXT_GUS_ENV", "GUS_MODE", "EXT_GUS_MODE"]))?.toLowerCase();
  if (env === "test" || env === "testing" || env === "dev") return { url: GUS_TEST_URL, label: "testowe" };

  return { url: GUS_PROD_URL, label: "produkcyjne" };
}

function extractResult(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseDaneRows(innerXml: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const daneRe = /<dane>([\s\S]*?)<\/dane>/g;
  let m: RegExpExecArray | null;
  while ((m = daneRe.exec(innerXml)) !== null) {
    const row: Record<string, string> = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[1])) !== null) {
      row[f[1]] = f[2].trim();
    }
    out.push(row);
  }
  return out;
}

async function zaloguj(apiKey: string, gusUrl: string, label: string): Promise<string> {
  const body = `<bir:Zaloguj><bir:pKluczUzytkownika>${apiKey}</bir:pKluczUzytkownika></bir:Zaloguj>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/Zaloguj`, body);
  const sid = extractResult(xml, "ZalogujResult").trim();
  if (!sid) throw new Error(`GUS: nie udało się zalogować (pusty sid — klucz nie pasuje do środowiska ${label}; sprawdź GUS_API_KEY albo ustaw GUS_ENV=test/prod)`);
  return sid;
}

const RAPORTY: Record<string, { glowny: string; pkd: string; prefix: string }> = {
  P:   { glowny: "BIR11OsPrawna",   pkd: "BIR11OsPrawnaPkd",   prefix: "praw_" },
  LP:  { glowny: "BIR11JednLokalnaOsPrawnej",  pkd: "BIR11JednLokalnaOsPrawnejPkd", prefix: "lokpraw_" },
  F:   { glowny: "BIR11OsFizycznaDaneOgolne", pkd: "BIR11OsFizycznaPkd", prefix: "fiz_" },
  LF:  { glowny: "BIR11JednLokalnaOsFizycznej", pkd: "BIR11JednLokalnaOsFizycznejPkd", prefix: "lokfiz_" },
};

async function szukajPodmioty(identifier: { nip?: string; regon?: string; krs?: string }, sid: string, gusUrl: string) {
  let param = "";
  if (identifier.nip) param = `<dat:Nip>${identifier.nip}</dat:Nip>`;
  else if (identifier.regon) param = `<dat:Regon>${identifier.regon}</dat:Regon>`;
  else if (identifier.krs) param = `<dat:Krs>${identifier.krs}</dat:Krs>`;
  else throw new Error("Brak identyfikatora");
  const body = `<bir:DaneSzukajPodmioty>
    <bir:pParametryWyszukiwania xmlns:dat="${NS_BIR_DATA}">${param}</bir:pParametryWyszukiwania>
  </bir:DaneSzukajPodmioty>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/DaneSzukajPodmioty`, body, sid);
  return parseDaneRows(decodeXml(extractResult(xml, "DaneSzukajPodmiotyResult")));
}

async function pobierzPelnyRaport(regon: string, nazwaRaportu: string, sid: string, gusUrl: string) {
  const body = `<bir:DanePobierzPelnyRaport>
    <bir:pRegon>${regon}</bir:pRegon>
    <bir:pNazwaRaportu>${nazwaRaportu}</bir:pNazwaRaportu>
  </bir:DanePobierzPelnyRaport>`;
  const xml = await soapCall(gusUrl, `${NS_BIR}/IUslugaBIRzewnPubl/DanePobierzPelnyRaport`, body, sid);
  return parseDaneRows(decodeXml(extractResult(xml, "DanePobierzPelnyRaportResult")));
}

function extractFullData(rows: Record<string, string>[], prefix: string) {
  if (!rows.length) return null;
  const r = rows[0];
  const get = (s: string) => r[`${prefix}${s}`] || null;
  return {
    data_powstania: get("dataPowstania") || get("dataUrodzenia"),
    data_rozpoczecia: get("dataRozpoczeciaDzialalnosci"),
    data_wpisu: get("dataWpisuDoRejestruEwidencji"),
    data_zawieszenia: get("dataZawieszeniaDzialalnosci"),
    data_wznowienia: get("dataWznowieniaDzialalnosci"),
    data_zakonczenia: get("dataZakonczeniaDzialalnosci"),
    data_skreslenia: get("dataSkresleniaZRegon"),
    data_upadlosci: get("dataOrzeczeniaOUpadlosci"),
    numer_w_rejestrze: get("numerWRejestrzeEwidencji"),
    forma_prawna: get("podstawowaFormaPrawna_Nazwa"),
    forma_szczegolna: get("szczegolnaFormaPrawna_Nazwa"),
    forma_finansowania: get("formaFinansowania_Nazwa"),
    forma_wlasnosci: get("formaWlasnosci_Nazwa"),
    organ_rejestrowy: get("organRejestrowy_Nazwa"),
    rodzaj_rejestru: get("rodzajRejestruEwidencji_Nazwa"),
    email: get("adresEmail") || get("email"),
    www: get("adresStronyinternetowej") || get("adresStronyWWW"),
    telefon: get("numerTelefonu"),
    liczba_jedn_lokalnych: get("liczbaJednLokalnych"),
  };
}

function extractPkd(rows: Record<string, string>[], prefix: string) {
  return rows
    .map((r) => ({
      kod: r[`${prefix}pkdKod`] || "",
      nazwa: r[`${prefix}pkdNazwa`] || "",
      przewazajace: r[`${prefix}pkdPrzewazajace`] === "1",
    }))
    .filter((p) => p.kod);
}

function normalize(row: Record<string, string>, pelny: Record<string, string | null> | null, pkd: ReturnType<typeof extractPkd>) {
  const typ = row.Typ;
  const ulica = row.Ulica || "";
  const numer = [row.NrNieruchomosci, row.NrLokalu].filter(Boolean).join("/");
  return {
    typ,
    typ_label: typ === "P" ? "Osoba prawna" : typ === "F" ? "Osoba fizyczna" : (typ === "LP" || typ === "LF") ? "Jednostka lokalna" : typ,
    nazwa: row.Nazwa || "",
    nip: row.Nip || "",
    regon: row.Regon || "",
    krs: row.KRS || "",
    adres: {
      ulica: ulica ? `${ulica} ${numer}`.trim() : numer,
      kod_pocztowy: row.KodPocztowy || "",
      miejscowosc: row.Miejscowosc || "",
      gmina: row.Gmina || "",
      powiat: row.Powiat || "",
      wojewodztwo: row.Wojewodztwo || "",
    },
    data_zakonczenia: row.DataZakonczeniaDzialalnosci || null,
    silosID: row.SilosID || null,
    pelny_raport: pelny || null,
    pkd,
  };
}

export const gusLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nip?: string; regon?: string; krs?: string; skipCache?: boolean; scope?: "basic" | "full" }) => input)
  .handler(async ({ data }) => {
    const apiKey = await readRuntimeSecret(["GUS_API_KEY", "EXT_GUS_API_KEY"]);
    if (!apiKey) throw new Error("Brak sekretu GUS_API_KEY na serwerze.");
    const gusEndpoint = await resolveGusEndpoint();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const zakres: "basic" | "full" = data.scope === "basic" ? "basic" : "full";
    const nipClean = data.nip?.replace(/\D/g, "") || undefined;
    const regonClean = data.regon?.replace(/\D/g, "") || undefined;
    let krsClean = data.krs?.replace(/\D/g, "") || undefined;
    if (krsClean && krsClean.length > 0 && krsClean.length < 10) {
      krsClean = krsClean.padStart(10, "0");
    }
    const ident = { nip: nipClean, regon: regonClean, krs: krsClean };
    if (!ident.nip && !ident.regon && !ident.krs) {
      throw new Error("Podaj NIP, REGON lub KRS");
    }

    // Cache (7 dni)
    if (!data.skipCache) {
      const col = ident.nip ? "nip" : ident.regon ? "regon" : "krs";
      const val = (ident as Record<string, string | undefined>)[col]!;
      const { data: cached } = await supabaseAdmin.from("gus_cache").select("*").eq(col, val).maybeSingle();
      if (cached) {
        const ageDays = (Date.now() - new Date(cached.pobrano).getTime()) / 86400000;
        const cachedHasFull = !!(cached.dane && (cached.dane.pelny_raport || (cached.dane.pkd && cached.dane.pkd.length)));
        if (ageDays < 7 && (zakres === "basic" || cachedHasFull)) {
          return { source: "cache" as const, scope: zakres, pobrano: cached.pobrano, dane: cached.dane };
        }
      }
    }

    // Sesja
    async function getSid(forceNew = false): Promise<string> {
      if (!forceNew) {
        const { data: s } = await supabaseAdmin.from("gus_sesja").select("sid, utworzono").eq("id", 1).maybeSingle();
        if (s?.sid && s?.utworzono) {
          const age = (Date.now() - new Date(s.utworzono).getTime()) / 1000;
          if (age < 55 * 60) return s.sid;
        }
      }
      const sid = await zaloguj(apiKey!, gusEndpoint.url, gusEndpoint.label);
      await supabaseAdmin.from("gus_sesja").upsert({ id: 1, sid, utworzono: new Date().toISOString() });
      return sid;
    }

    let sid = await getSid();
    let rows: Record<string, string>[];
    try {
      rows = await szukajPodmioty(ident, sid, gusEndpoint.url);
    } catch {
      sid = await getSid(true);
      rows = await szukajPodmioty(ident, sid, gusEndpoint.url);
    }

    if (!rows.length) {
      return { source: "gus" as const, scope: zakres, dane: null, error: "Nie znaleziono podmiotu w rejestrze GUS" };
    }

    const baseRow = rows[0];
    let pelny: Record<string, string | null> | null = null;
    let pkdList: ReturnType<typeof extractPkd> = [];
    if (zakres === "full") {
      try {
        const config = RAPORTY[baseRow.Typ];
        if (config) {
          const pelnyRows = await pobierzPelnyRaport(baseRow.Regon, config.glowny, sid, gusEndpoint.url);
          pelny = extractFullData(pelnyRows, config.prefix);
          const pkdRows = await pobierzPelnyRaport(baseRow.Regon, config.pkd, sid, gusEndpoint.url);
          pkdList = extractPkd(pkdRows, config.prefix);
        }
      } catch {
        // pomiń — podstawowe dane mamy
      }
    }

    const normalized = normalize(baseRow, pelny, pkdList);
    if (!normalized.krs) {
      normalized.krs = (pelny?.numer_w_rejestrze as string) || ident.krs || "";
    }

    await supabaseAdmin.from("gus_cache").upsert(
      {
        nip: normalized.nip || null,
        regon: normalized.regon || null,
        krs: normalized.krs || null,
        dane: normalized,
        pobrano: new Date().toISOString(),
      },
      { onConflict: ident.nip ? "nip" : ident.regon ? "regon" : "krs" },
    );

    return { source: "gus" as const, scope: zakres, dane: normalized, raw: baseRow };
  });
