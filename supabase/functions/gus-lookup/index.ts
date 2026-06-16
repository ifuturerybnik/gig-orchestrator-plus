import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GUS_URL = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc";
const NS_ADDR = "http://www.w3.org/2005/08/addressing";
const NS_BIR = "http://CIS/BIR/PUBL/2014/07";
const NS_BIR_DATA = "http://CIS/BIR/PUBL/2014/07/DataContract";

const SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
  Deno.env.get("EXTERNAL_SUPABASE_SECRET_KEY") ??
  Deno.env.get("EXTERNAL_DB_SERVICE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GUS_API_KEY = Deno.env.get("GUS_API_KEY")!;

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Throttle: max 1 SOAP request / sekundę (zalecenie GUS przy operacjach masowych).
// Globalny łańcuch promise zapewnia odstęp niezależnie od liczby równoległych wywołań funkcji.
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

function envelope(action: string, body: string, sid?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="${NS_ADDR}" xmlns:bir="${NS_BIR}">
  <soap:Header>
    <wsa:To>${GUS_URL}</wsa:To>
    <wsa:Action>${action}</wsa:Action>
  </soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

async function soapCall(action: string, body: string, sid?: string): Promise<string> {
  await throttleSoap();
  const headers: Record<string, string> = {
    "Content-Type": "application/soap+xml; charset=utf-8",
  };
  if (sid) headers["sid"] = sid;

  const r = await fetch(GUS_URL, {
    method: "POST",
    headers,
    body: envelope(action, body, sid),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GUS HTTP ${r.status}: ${text.slice(0, 500)}`);
  return text;
}

function extractResult(xml: string, tag: string): string {
  // tag e.g. ZalogujResult, DaneSzukajPodmiotyResult
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
  // Inner XML is <root><dane>...</dane><dane>...</dane></root>
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

async function zaloguj(): Promise<string> {
  const body = `<bir:Zaloguj><bir:pKluczUzytkownika>${GUS_API_KEY}</bir:pKluczUzytkownika></bir:Zaloguj>`;
  const xml = await soapCall(`${NS_BIR}/IUslugaBIRzewnPubl/Zaloguj`, body);
  const sid = extractResult(xml, "ZalogujResult").trim();
  if (!sid) throw new Error("GUS: nie udało się zalogować (pusty sid)");
  return sid;
}

async function getSid(forceNew = false): Promise<string> {
  if (!forceNew) {
    const { data } = await supa.from("gus_sesja").select("sid, utworzono").eq("id", 1).maybeSingle();
    if (data?.sid && data?.utworzono) {
      const age = (Date.now() - new Date(data.utworzono).getTime()) / 1000;
      if (age < 55 * 60) return data.sid;
    }
  }
  const sid = await zaloguj();
  await supa.from("gus_sesja").upsert({ id: 1, sid, utworzono: new Date().toISOString() });
  return sid;
}

async function szukajPodmioty(identifier: { nip?: string; regon?: string; krs?: string }, sid: string) {
  let param = "";
  if (identifier.nip) param = `<dat:Nip>${identifier.nip}</dat:Nip>`;
  else if (identifier.regon) param = `<dat:Regon>${identifier.regon}</dat:Regon>`;
  else if (identifier.krs) param = `<dat:Krs>${identifier.krs}</dat:Krs>`;
  else throw new Error("Brak identyfikatora (NIP/REGON/KRS)");

  const body = `<bir:DaneSzukajPodmioty>
    <bir:pParametryWyszukiwania xmlns:dat="${NS_BIR_DATA}">
      ${param}
    </bir:pParametryWyszukiwania>
  </bir:DaneSzukajPodmioty>`;
  const xml = await soapCall(`${NS_BIR}/IUslugaBIRzewnPubl/DaneSzukajPodmioty`, body, sid);
  const inner = decodeXml(extractResult(xml, "DaneSzukajPodmiotyResult"));
  return parseDaneRows(inner);
}

const RAPORTY: Record<string, { glowny: string; pkd: string; prefix: string }> = {
  P:   { glowny: "BIR11OsPrawna",   pkd: "BIR11OsPrawnaPkd",   prefix: "praw_" },
  LP:  { glowny: "BIR11JednLokalnaOsPrawnej",  pkd: "BIR11JednLokalnaOsPrawnejPkd", prefix: "lokpraw_" },
  F:   { glowny: "BIR11OsFizycznaDaneOgolne", pkd: "BIR11OsFizycznaPkd", prefix: "fiz_" },
  LF:  { glowny: "BIR11JednLokalnaOsFizycznej", pkd: "BIR11JednLokalnaOsFizycznejPkd", prefix: "lokfiz_" },
};

async function pobierzPelnyRaport(regon: string, nazwaRaportu: string, sid: string): Promise<Record<string, string>[]> {
  const body = `<bir:DanePobierzPelnyRaport>
    <bir:pRegon>${regon}</bir:pRegon>
    <bir:pNazwaRaportu>${nazwaRaportu}</bir:pNazwaRaportu>
  </bir:DanePobierzPelnyRaport>`;
  const xml = await soapCall(`${NS_BIR}/IUslugaBIRzewnPubl/DanePobierzPelnyRaport`, body, sid);
  const inner = decodeXml(extractResult(xml, "DanePobierzPelnyRaportResult"));
  return parseDaneRows(inner);
}

function extractFullData(rows: Record<string, string>[], prefix: string) {
  if (!rows.length) return null;
  const r = rows[0];
  const get = (suffix: string) => r[`${prefix}${suffix}`] || null;
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
  return rows.map((r) => ({
    kod: r[`${prefix}pkdKod`] || "",
    nazwa: r[`${prefix}pkdNazwa`] || "",
    przewazajace: r[`${prefix}pkdPrzewazajace`] === "1",
  })).filter((p) => p.kod);
}

function normalize(row: Record<string, string>, pelny?: Record<string, any> | null, pkd?: any[]) {
  if (!row) return null;
  const typ = row.Typ;
  const ulica = row.Ulica || "";
  const numer = [row.NrNieruchomosci, row.NrLokalu].filter(Boolean).join("/");
  return {
    typ,
    typ_label: typ === "P" ? "Osoba prawna" : typ === "F" ? "Osoba fizyczna" : typ === "LP" || typ === "LF" ? "Jednostka lokalna" : typ,
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
    pkd: pkd || [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { nip, regon, krs, skipCache, scope } = await req.json();
    const zakres: "basic" | "full" = scope === "basic" ? "basic" : "full";
    const nipClean = nip?.replace(/\D/g, "") || undefined;
    const regonClean = regon?.replace(/\D/g, "") || undefined;
    let krsClean = krs?.replace(/\D/g, "") || undefined;
    // KRS w GUS musi mieć 10 cyfr — uzupełniamy wiodące zera (np. "6865" → "0000006865")
    if (krsClean && krsClean.length > 0 && krsClean.length < 10) {
      krsClean = krsClean.padStart(10, "0");
    }
    const ident = { nip: nipClean, regon: regonClean, krs: krsClean };
    if (!ident.nip && !ident.regon && !ident.krs) {
      return new Response(JSON.stringify({ error: "Podaj NIP, REGON lub KRS" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache (7 dni)
    if (!skipCache) {
      const col = ident.nip ? "nip" : ident.regon ? "regon" : "krs";
      const val = (ident as any)[col];
      const { data: cached } = await supa.from("gus_cache").select("*").eq(col, val).maybeSingle();
      if (cached) {
        const ageDays = (Date.now() - new Date(cached.pobrano).getTime()) / 86400000;
        const cachedHasFull = !!(cached.dane && (cached.dane.pelny_raport || (cached.dane.pkd && cached.dane.pkd.length)));
        const cacheSatisfies = zakres === "basic" || cachedHasFull;
        if (ageDays < 7 && cacheSatisfies) {
          return new Response(JSON.stringify({ source: "cache", scope: zakres, pobrano: cached.pobrano, dane: cached.dane }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    let sid = await getSid();
    let rows: Record<string, string>[];
    try {
      rows = await szukajPodmioty(ident, sid);
    } catch (e) {
      // retry once with fresh sid
      sid = await getSid(true);
      rows = await szukajPodmioty(ident, sid);
    }

    if (!rows.length) {
      return new Response(JSON.stringify({ source: "gus", dane: null, error: "Nie znaleziono podmiotu w rejestrze GUS" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseRow = rows[0];
    const typ = baseRow.Typ;
    let pelny: Record<string, any> | null = null;
    let pkdList: any[] = [];
    if (zakres === "full") try {
      const config = RAPORTY[typ];
      if (config) {
        const pelnyRows = await pobierzPelnyRaport(baseRow.Regon, config.glowny, sid);
        pelny = extractFullData(pelnyRows, config.prefix);
        const pkdRows = await pobierzPelnyRaport(baseRow.Regon, config.pkd, sid);
        pkdList = extractPkd(pkdRows, config.prefix);
      }
    } catch (_) {
      // ignorujemy błędy pełnego raportu — podstawowe dane i tak mamy
    }

    const normalized = normalize(baseRow, pelny, pkdList);

    // GUS w DaneSzukajPodmioty nie zwraca KRS — uzupełniamy z pełnego raportu lub z parametru wejściowego
    if (normalized && !normalized.krs) {
      normalized.krs = (pelny?.numer_w_rejestrze as string) || ident.krs || "";
    }

    // Zapis do cache
    await supa.from("gus_cache").upsert(
      {
        nip: normalized?.nip || null,
        regon: normalized?.regon || null,
        krs: normalized?.krs || null,
        dane: normalized,
        pobrano: new Date().toISOString(),
      },
      { onConflict: ident.nip ? "nip" : ident.regon ? "regon" : "krs" }
    );

    return new Response(JSON.stringify({ source: "gus", scope: zakres, dane: normalized, raw: rows[0] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});