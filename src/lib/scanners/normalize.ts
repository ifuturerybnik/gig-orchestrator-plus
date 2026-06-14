// Wspólna normalizacja nazw / miejscowości dla skanerów BAE / GUS / RSPO.
// Bezpieczne client+server (czysta funkcja, bez I/O).

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const PREFIX_RE =
  /^(urząd|urzad|gminny|gminna|gminne|miejski|miejska|miejskie|powiatowy|powiatowa|powiatowe|wojewódzki|wojewodzki|samorządowy|samorzadowy|publiczna|publiczny|publiczne|miejsko-gminny|miejsko-gminna|miejsko-gminne|gminno-miejski|samodzielny)\s+/;

const STOPWORDS = new Set([
  "w", "we", "im", "imienia", "the", "a", "i", "oraz",
  "nr", "no", "dla", "do", "od", "na", "z", "ze",
]);

/**
 * Znormalizowana nazwa: bez diakrytyków, lower-case, bez wielokrotnych spacji,
 * bez typowych prefixów ("urząd gminy", "publiczna szkoła ..."), bez kropek/przecinków.
 */
export function normalizeName(raw?: string | null): string {
  if (!raw) return "";
  let s = stripDiacritics(String(raw))
    .toLowerCase()
    .replace(/[.,;:"'`()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // odpalamy prefixy max 3x (np. "publiczna szkola podstawowa nr 1 im. ...")
  for (let i = 0; i < 3; i++) {
    const next = s.replace(PREFIX_RE, "");
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

/** Klucz indeksu: name + city (oba znormalizowane). */
export function makeNameCityKey(name?: string | null, city?: string | null): string {
  return `${normalizeName(name)}|${normalizeName(city)}`;
}

/** Tokeny do fuzzy match (bez stopwords, bez duplikatów). */
export function tokenize(raw?: string | null): Set<string> {
  const norm = normalizeName(raw);
  const tokens = norm.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** Jaccard similarity 0..1 na tokenach. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}
