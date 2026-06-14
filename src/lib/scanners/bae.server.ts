// SERVER-ONLY: pobiera i indeksuje rejestr BAE (e-Doręczenia, gov.pl).
// Endpoint XHR strony "Sprawdź, czy Twój urząd korzysta z e-Doręczeń".
// Zwraca ~47k rekordów w jednym JSON-ie (~8.5 MB). Cache modułowy TTL 10 min.

import {
  makeNameCityKey,
  normalizeName,
  tokenize,
  jaccard,
  citiesMatchLoose,
  extractTypePhrase,
} from "./normalize";

const BAE_URL = "https://www.gov.pl/api/data/registers/search?pageId=21113705";
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface BaeRecord {
  ADE: string;
  REGON: string;
  MIEJSCOWOSC: string;
  WOJEWODZTWO: string;
  NAZWA_PODMIOTU: string;
}

interface BaeIndex {
  fetchedAt: number;
  total: number;
  byRegon: Map<string, BaeRecord>;
  byAde: Map<string, BaeRecord>;
  byNameCity: Map<string, BaeRecord[]>;
  /** lista użyta do fuzzy matchu (bez duplikatów po REGON) */
  all: BaeRecord[];
}

let cached: BaeIndex | null = null;
let inFlight: Promise<BaeIndex> | null = null;

async function fetchAndBuild(): Promise<BaeIndex> {
  const res = await fetch(BAE_URL, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer:
        "https://www.gov.pl/web/e-doreczenia/sprawdz-czy-twoj-urzad-korzysta-z-e-doreczen",
      "User-Agent":
        "Mozilla/5.0 (compatible; ConcertivoBot/1.0; +https://concertivo.eu)",
    },
  });
  if (!res.ok) {
    throw new Error(`BAE fetch failed: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as BaeRecord[];
  if (!Array.isArray(raw)) {
    throw new Error("BAE: nieoczekiwany format odpowiedzi");
  }
  const byRegon = new Map<string, BaeRecord>();
  const byAde = new Map<string, BaeRecord>();
  const byNameCity = new Map<string, BaeRecord[]>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    if (r.REGON) byRegon.set(r.REGON.trim(), r);
    if (r.ADE) byAde.set(r.ADE.trim(), r);
    const key = makeNameCityKey(r.NAZWA_PODMIOTU, r.MIEJSCOWOSC);
    if (key !== "|") {
      const list = byNameCity.get(key);
      if (list) list.push(r);
      else byNameCity.set(key, [r]);
    }
  }
  return {
    fetchedAt: Date.now(),
    total: raw.length,
    byRegon,
    byAde,
    byNameCity,
    all: raw,
  };
}

export async function getBaeIndex(): Promise<BaeIndex> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = fetchAndBuild()
    .then((idx) => {
      cached = idx;
      return idx;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface BaeQuery {
  id: string;
  name: string | null;
  miejscowosc: string | null;
  wojewodztwo: string | null;
  regon: string | null;
  currentAde: string | null;
}

export type MatchConfidence = "exact_regon" | "exact_name_city" | "fuzzy" | "none";

export interface BaeMatch {
  entityId: string;
  confidence: MatchConfidence;
  /** Score 0..1, tylko dla 'fuzzy'. */
  score?: number;
  match?: BaeRecord;
  /** Lista alternatyw (gdy exact_name_city zwróciło >1 lub fuzzy). */
  candidates?: BaeRecord[];
}

const FUZZY_MIN = 0.55;

export type MatchMode = "standard" | "partial_type";

export async function matchInBae(
  queries: BaeQuery[],
  mode: MatchMode = "standard",
): Promise<BaeMatch[]> {
  if (mode === "partial_type") return matchInBaePartial(queries);
  const idx = await getBaeIndex();
  const out: BaeMatch[] = [];
  for (const q of queries) {
    // 1. REGON
    if (q.regon) {
      const hit = idx.byRegon.get(q.regon.trim());
      if (hit) {
        out.push({ entityId: q.id, confidence: "exact_regon", match: hit });
        continue;
      }
    }
    // 2. nazwa+miejscowość — dokładnie
    const key = makeNameCityKey(q.name, q.miejscowosc);
    if (key !== "|") {
      const exact = idx.byNameCity.get(key);
      if (exact && exact.length === 1) {
        out.push({ entityId: q.id, confidence: "exact_name_city", match: exact[0] });
        continue;
      }
      if (exact && exact.length > 1) {
        // Doprecyzuj po województwie, jeśli mamy.
        const woj = q.wojewodztwo?.toUpperCase() ?? null;
        const narrowed = woj
          ? exact.filter((r) => r.WOJEWODZTWO?.toUpperCase() === woj)
          : exact;
        if (narrowed.length === 1) {
          out.push({
            entityId: q.id,
            confidence: "exact_name_city",
            match: narrowed[0],
          });
          continue;
        }
        out.push({
          entityId: q.id,
          confidence: "fuzzy",
          score: 0.7,
          candidates: narrowed.length > 0 ? narrowed : exact,
        });
        continue;
      }
    }
    // 3. fuzzy: szukaj kandydatów w tej samej miejscowości (jeśli mamy),
    //    inaczej w tym samym województwie.
    const cityNorm = normalizeName(q.miejscowosc);
    const wojNorm = (q.wojewodztwo || "").toUpperCase();
    const pool = cityNorm
      ? idx.all.filter((r) => normalizeName(r.MIEJSCOWOSC) === cityNorm)
      : wojNorm
        ? idx.all.filter((r) => r.WOJEWODZTWO?.toUpperCase() === wojNorm)
        : [];
    if (pool.length === 0) {
      out.push({ entityId: q.id, confidence: "none" });
      continue;
    }
    const qTokens = tokenize(q.name);
    let best: { rec: BaeRecord; score: number } | null = null;
    const others: Array<{ rec: BaeRecord; score: number }> = [];
    for (const rec of pool) {
      const s = jaccard(qTokens, tokenize(rec.NAZWA_PODMIOTU));
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
  return out;
}

/**
 * Partial-type matching: szukaj kandydatów, których nazwa zawiera „typ jednostki"
 * (np. „centrum kultury", „dom kultury", „biblioteka publiczna") wyciągnięty
 * z nazwy naszego rekordu, a miejscowość pasuje luźno (po stemie, ignorując
 * końcówki przypadków typu „Cieszków" vs „Cieszkowie").
 *
 * Wynik: jeśli dokładnie 1 kandydat → "exact_name_city" (wysoka pewność dla
 * UI; użytkownik i tak akceptuje ręcznie). Jeśli >1 → "fuzzy" z listą
 * kandydatów. Jeśli 0 lub brak typu/miasta → "none".
 */
async function matchInBaePartial(queries: BaeQuery[]): Promise<BaeMatch[]> {
  const idx = await getBaeIndex();
  const out: BaeMatch[] = [];
  for (const q of queries) {
    // 1. najpierw spróbuj po REGON (tani pewniak).
    if (q.regon) {
      const hit = idx.byRegon.get(q.regon.trim());
      if (hit) {
        out.push({ entityId: q.id, confidence: "exact_regon", match: hit });
        continue;
      }
    }
    const typePhrase = extractTypePhrase(q.name);
    if (!typePhrase || !q.miejscowosc) {
      out.push({ entityId: q.id, confidence: "none" });
      continue;
    }
    const matches: BaeRecord[] = [];
    for (const rec of idx.all) {
      const recName = normalizeName(rec.NAZWA_PODMIOTU);
      if (!recName.includes(typePhrase)) continue;
      if (!citiesMatchLoose(q.miejscowosc, rec.MIEJSCOWOSC)) continue;
      // doprecyzowanie po województwie, jeśli mamy
      if (
        q.wojewodztwo &&
        rec.WOJEWODZTWO &&
        rec.WOJEWODZTWO.toUpperCase() !== q.wojewodztwo.toUpperCase()
      ) {
        continue;
      }
      matches.push(rec);
      if (matches.length > 25) break; // ochrona przed eksplozją
    }
    if (matches.length === 0) {
      out.push({ entityId: q.id, confidence: "none" });
    } else if (matches.length === 1) {
      out.push({
        entityId: q.id,
        confidence: "exact_name_city",
        score: 0.85,
        match: matches[0],
      });
    } else {
      // wybierz najlepszego po jaccard nazw, resztę pokaż jako kandydatów
      const qTokens = tokenize(q.name);
      const scored = matches
        .map((rec) => ({ rec, s: jaccard(qTokens, tokenize(rec.NAZWA_PODMIOTU)) }))
        .sort((a, b) => b.s - a.s);
      out.push({
        entityId: q.id,
        confidence: "fuzzy",
        score: Math.max(0.6, scored[0].s),
        match: scored[0].rec,
        candidates: scored.slice(1, 5).map((x) => x.rec),
      });
    }
  }
  return out;
}
