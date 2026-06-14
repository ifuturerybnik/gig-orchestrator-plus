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

/**
 * Stem miejscowości — usuwa typowe polskie końcówki przypadków, żeby
 * "Cieszków" (M.) i "Cieszkowie" (Msc.) lub "Cieszkowa" (D.) dawały ten sam stem.
 * Działa na wartości już znormalizowanej (`normalizeName`).
 */
export function cityStem(raw?: string | null): string {
  let s = normalizeName(raw).replace(/\s+/g, "");
  if (!s) return "";
  const suffixes = [
    "owie", "owej", "owym", "owych", "ami", "ach", "ego", "emu",
    "ow", "ie", "iu", "em", "om", "ej", "ym", "ych",
    "u", "e", "a", "y", "i", "o",
  ];
  for (const suf of suffixes) {
    if (s.length - suf.length >= 4 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
}

/** Czy dwa miasta są „luźno" tym samym (po stemie / prefiksie). */
export function citiesMatchLoose(a?: string | null, b?: string | null): boolean {
  const sa = cityStem(a);
  const sb = cityStem(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const min = Math.min(sa.length, sb.length);
  if (min < 5) return false;
  return sa.startsWith(sb) || sb.startsWith(sa);
}

/**
 * Lista znormalizowanych fraz oznaczających „typ jednostki". Kolejność od
 * najdłuższych do najkrótszych — pierwsze trafienie wygrywa.
 */
export const INSTITUTION_TYPE_PHRASES: readonly string[] = [
  "miejsko gminny osrodek kultury",
  "miejsko gminne centrum kultury",
  "gminny osrodek kultury i sportu",
  "centrum kultury i sportu",
  "centrum kultury sportu i rekreacji",
  "gminny osrodek kultury",
  "miejski osrodek kultury",
  "powiatowy osrodek kultury",
  "wojewodzki osrodek kultury",
  "samorzadowy osrodek kultury",
  "gminne centrum kultury",
  "miejskie centrum kultury",
  "centrum kultury",
  "osrodek kultury",
  "dom kultury",
  "miejska biblioteka publiczna",
  "gminna biblioteka publiczna",
  "biblioteka publiczna",
  "biblioteka",
  "szkola podstawowa",
  "zespol szkolno przedszkolny",
  "zespol szkol",
  "liceum ogolnoksztalcace",
  "liceum",
  "technikum",
  "przedszkole publiczne",
  "przedszkole samorzadowe",
  "przedszkole",
  "urzad miasta i gminy",
  "urzad gminy",
  "urzad miasta",
  "urzad miejski",
  "starostwo powiatowe",
  "urzad marszalkowski",
  "muzeum",
  "teatr",
  "filharmonia",
  "galeria sztuki",
  "galeria",
  "ochotnicza straz pozarna",
  "centrum uslug wspolnych",
  "centrum uslug spolecznych",
  "osrodek pomocy spolecznej",
  "gminny osrodek pomocy spolecznej",
  "miejski osrodek pomocy spolecznej",
];

/** Wyciągnij typ jednostki z nazwy (zwraca znormalizowaną frazę lub ""). */
export function extractTypePhrase(raw?: string | null): string {
  const norm = normalizeName(raw);
  if (!norm) return "";
  for (const phrase of INSTITUTION_TYPE_PHRASES) {
    if (norm.includes(phrase)) return phrase;
  }
  return "";
}
