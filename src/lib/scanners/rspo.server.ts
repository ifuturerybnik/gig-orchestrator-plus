// SERVER-ONLY: Rejestr Szkół i Placówek Oświatowych (MEN).
// REST publiczny (Hydra/JSON-LD), bez klucza.
// Endpoint: https://api-rspo.mein.gov.pl/api/placowki/?miejscowosc=<city>&page=<n>
// Strategia: dla unikalnych miejscowości w batchu pobieramy strony (cap),
// budujemy lokalny indeks i dopasowujemy fuzzy po nazwie.

import { normalizeName, tokenize, jaccard } from "./normalize";

const RSPO_BASE = "https://api-rspo.mein.gov.pl/api/placowki";
const PAGE_SIZE = 30; // domyślny rozmiar strony Hydra
const MAX_PAGES_PER_CITY = 6; // do ~180 placówek / miasto (limit sanity)
const REQUEST_DELAY_MS = 600; // łagodne tempo
const CITY_CACHE_TTL_MS = 30 * 60 * 1000;

export interface RspoRecord {
  numerRspo?: number | string;
  nazwa?: string;
  miejscowosc?: string;
  kodPocztowy?: string;
  ulica?: string;
  numerBudynku?: string;
  numerLokalu?: string;
  telefon?: string;
  email?: string;
  stronaInternetowa?: string;
  nip?: string;
  regon?: string;
  wojewodztwo?: string;
  powiat?: string;
  gmina?: string;
}

interface CacheEntry {
  fetchedAt: number;
  records: RspoRecord[];
}

const cityCache = new Map<string, CacheEntry>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCityPages(city: string): Promise<RspoRecord[]> {
  const cached = cityCache.get(city);
  if (cached && Date.now() - cached.fetchedAt < CITY_CACHE_TTL_MS) {
    return cached.records;
  }
  const all: RspoRecord[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_CITY; page++) {
    const url = `${RSPO_BASE}/?miejscowosc=${encodeURIComponent(city)}&page=${page}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; ConcertivoBot/1.0; +https://concertivo.eu)",
        },
      });
    } catch {
      break;
    }
    if (!res.ok) break;
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      break;
    }
    // API zwraca albo array (application/json), albo Hydra collection.
    let items: RspoRecord[] = [];
    if (Array.isArray(body)) {
      items = body as RspoRecord[];
    } else if (
      body &&
      typeof body === "object" &&
      Array.isArray((body as Record<string, unknown>)["hydra:member"])
    ) {
      items = (body as Record<string, unknown>)["hydra:member"] as RspoRecord[];
    }
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    if (page < MAX_PAGES_PER_CITY) await sleep(REQUEST_DELAY_MS);
  }
  cityCache.set(city, { fetchedAt: Date.now(), records: all });
  return all;
}

export interface RspoQuery {
  id: string;
  name: string | null;
  miejscowosc: string | null;
  regon: string | null;
}

export type RspoConfidence = "exact_regon" | "exact_name_city" | "fuzzy" | "none";

export interface RspoMatch {
  entityId: string;
  confidence: RspoConfidence;
  score?: number;
  match?: RspoRecord;
  candidates?: RspoRecord[];
}

const FUZZY_MIN = 0.55;

export async function matchInRspo(queries: RspoQuery[]): Promise<RspoMatch[]> {
  // Grupuj po miejscowości, aby zminimalizować liczbę requestów.
  const byCity = new Map<string, RspoQuery[]>();
  for (const q of queries) {
    const city = (q.miejscowosc || "").trim();
    if (!city) continue;
    const list = byCity.get(city) ?? [];
    list.push(q);
    byCity.set(city, list);
  }

  const out: RspoMatch[] = [];
  const handled = new Set<string>();

  for (const [city, qs] of byCity) {
    const records = await fetchCityPages(city);
    // Indeks lokalny po REGON i po name-key.
    const byRegon = new Map<string, RspoRecord>();
    for (const r of records) {
      if (r.regon) byRegon.set(String(r.regon).trim(), r);
    }
    for (const q of qs) {
      handled.add(q.id);
      // 1) REGON
      if (q.regon) {
        const hit = byRegon.get(q.regon.trim());
        if (hit) {
          out.push({ entityId: q.id, confidence: "exact_regon", match: hit });
          continue;
        }
      }
      // 2) nazwa fuzzy (po znormalizowanej nazwie)
      const qNameNorm = normalizeName(q.name);
      const exact = records.find((r) => normalizeName(r.nazwa) === qNameNorm);
      if (exact && qNameNorm) {
        out.push({ entityId: q.id, confidence: "exact_name_city", match: exact });
        continue;
      }
      const qTokens = tokenize(q.name);
      let best: { rec: RspoRecord; score: number } | null = null;
      const others: Array<{ rec: RspoRecord; score: number }> = [];
      for (const rec of records) {
        const s = jaccard(qTokens, tokenize(rec.nazwa));
        if (s >= FUZZY_MIN) {
          if (!best || s > best.score) {
            if (best) others.push(best);
            best = { rec, score: s };
          } else {
            others.push({ rec, score: s });
          }
        }
      }
      if (best) {
        out.push({
          entityId: q.id,
          confidence: "fuzzy",
          score: best.score,
          match: best.rec,
          candidates: others
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map((x) => x.rec),
        });
      } else {
        out.push({ entityId: q.id, confidence: "none" });
      }
    }
  }

  // Encje bez miejscowości -> none.
  for (const q of queries) {
    if (!handled.has(q.id)) {
      out.push({ entityId: q.id, confidence: "none" });
    }
  }

  return out;
}

/** Buduje patch z rekordu RSPO, pomijając pola które już są wypełnione tą samą wartością. */
export function buildRspoPatch(
  rec: RspoRecord,
  current: {
    phone: string | null;
    email: string | null;
    www: string | null;
    nip: string | null;
    regon: string | null;
    kod_pocztowy: string | null;
    ulica: string | null;
    nr_domu: string | null;
  },
): Record<string, string> {
  const patch: Record<string, string> = {};
  const set = (key: string, val: string | undefined | null, curr: string | null) => {
    if (!val) return;
    const v = String(val).trim();
    if (!v) return;
    if (v === (curr ?? "")) return;
    patch[key] = v;
  };
  set("phone", rec.telefon, current.phone);
  set("email", rec.email, current.email);
  set("www", rec.stronaInternetowa, current.www);
  set("nip", rec.nip, current.nip);
  set("regon", rec.regon, current.regon);
  set("kod_pocztowy", rec.kodPocztowy, current.kod_pocztowy);
  set("ulica", rec.ulica, current.ulica);
  const nr = [rec.numerBudynku, rec.numerLokalu].filter(Boolean).join("/");
  set("nr_domu", nr, current.nr_domu);
  return patch;
}
