// ============================================================================
// Concertivo — globalna lista krajów (ISO-2, nazwy PL/EN, prefiks telefoniczny)
// ============================================================================
// Używana globalnie przez komponenty CountrySelect i PhoneInput.

export type CountryCode = string; // ISO-3166-1 alpha-2

export interface Country {
  code: CountryCode;
  name_pl: string;
  name_en: string;
  dial: string; // np. "48" (bez "+")
}

export const COUNTRIES: readonly Country[] = [
  { code: "PL", name_pl: "Polska", name_en: "Poland", dial: "48" },
  { code: "DE", name_pl: "Niemcy", name_en: "Germany", dial: "49" },
  { code: "CZ", name_pl: "Czechy", name_en: "Czechia", dial: "420" },
  { code: "SK", name_pl: "Słowacja", name_en: "Slovakia", dial: "421" },
  { code: "UA", name_pl: "Ukraina", name_en: "Ukraine", dial: "380" },
  { code: "LT", name_pl: "Litwa", name_en: "Lithuania", dial: "370" },
  { code: "LV", name_pl: "Łotwa", name_en: "Latvia", dial: "371" },
  { code: "EE", name_pl: "Estonia", name_en: "Estonia", dial: "372" },
  { code: "BY", name_pl: "Białoruś", name_en: "Belarus", dial: "375" },
  { code: "AT", name_pl: "Austria", name_en: "Austria", dial: "43" },
  { code: "CH", name_pl: "Szwajcaria", name_en: "Switzerland", dial: "41" },
  { code: "FR", name_pl: "Francja", name_en: "France", dial: "33" },
  { code: "BE", name_pl: "Belgia", name_en: "Belgium", dial: "32" },
  { code: "NL", name_pl: "Holandia", name_en: "Netherlands", dial: "31" },
  { code: "LU", name_pl: "Luksemburg", name_en: "Luxembourg", dial: "352" },
  { code: "GB", name_pl: "Wielka Brytania", name_en: "United Kingdom", dial: "44" },
  { code: "IE", name_pl: "Irlandia", name_en: "Ireland", dial: "353" },
  { code: "ES", name_pl: "Hiszpania", name_en: "Spain", dial: "34" },
  { code: "PT", name_pl: "Portugalia", name_en: "Portugal", dial: "351" },
  { code: "IT", name_pl: "Włochy", name_en: "Italy", dial: "39" },
  { code: "DK", name_pl: "Dania", name_en: "Denmark", dial: "45" },
  { code: "SE", name_pl: "Szwecja", name_en: "Sweden", dial: "46" },
  { code: "NO", name_pl: "Norwegia", name_en: "Norway", dial: "47" },
  { code: "FI", name_pl: "Finlandia", name_en: "Finland", dial: "358" },
  { code: "IS", name_pl: "Islandia", name_en: "Iceland", dial: "354" },
  { code: "HU", name_pl: "Węgry", name_en: "Hungary", dial: "36" },
  { code: "RO", name_pl: "Rumunia", name_en: "Romania", dial: "40" },
  { code: "BG", name_pl: "Bułgaria", name_en: "Bulgaria", dial: "359" },
  { code: "GR", name_pl: "Grecja", name_en: "Greece", dial: "30" },
  { code: "HR", name_pl: "Chorwacja", name_en: "Croatia", dial: "385" },
  { code: "SI", name_pl: "Słowenia", name_en: "Slovenia", dial: "386" },
  { code: "RS", name_pl: "Serbia", name_en: "Serbia", dial: "381" },
  { code: "BA", name_pl: "Bośnia i Hercegowina", name_en: "Bosnia and Herzegovina", dial: "387" },
  { code: "ME", name_pl: "Czarnogóra", name_en: "Montenegro", dial: "382" },
  { code: "MK", name_pl: "Macedonia Północna", name_en: "North Macedonia", dial: "389" },
  { code: "AL", name_pl: "Albania", name_en: "Albania", dial: "355" },
  { code: "TR", name_pl: "Turcja", name_en: "Turkey", dial: "90" },
  { code: "MT", name_pl: "Malta", name_en: "Malta", dial: "356" },
  { code: "CY", name_pl: "Cypr", name_en: "Cyprus", dial: "357" },
  { code: "US", name_pl: "Stany Zjednoczone", name_en: "United States", dial: "1" },
  { code: "CA", name_pl: "Kanada", name_en: "Canada", dial: "1" },
  { code: "MX", name_pl: "Meksyk", name_en: "Mexico", dial: "52" },
  { code: "BR", name_pl: "Brazylia", name_en: "Brazil", dial: "55" },
  { code: "AR", name_pl: "Argentyna", name_en: "Argentina", dial: "54" },
  { code: "AU", name_pl: "Australia", name_en: "Australia", dial: "61" },
  { code: "NZ", name_pl: "Nowa Zelandia", name_en: "New Zealand", dial: "64" },
  { code: "JP", name_pl: "Japonia", name_en: "Japan", dial: "81" },
  { code: "KR", name_pl: "Korea Południowa", name_en: "South Korea", dial: "82" },
  { code: "CN", name_pl: "Chiny", name_en: "China", dial: "86" },
  { code: "IN", name_pl: "Indie", name_en: "India", dial: "91" },
  { code: "AE", name_pl: "Zjednoczone Emiraty Arabskie", name_en: "United Arab Emirates", dial: "971" },
  { code: "IL", name_pl: "Izrael", name_en: "Israel", dial: "972" },
  { code: "ZA", name_pl: "RPA", name_en: "South Africa", dial: "27" },
];

const LANG_TO_COUNTRY: Record<string, CountryCode> = {
  pl: "PL",
  en: "GB",
  de: "DE",
  fr: "FR",
  es: "ES",
  it: "IT",
  cs: "CZ",
  uk: "UA",
};

export function getCountry(code?: string | null): Country | undefined {
  if (!code) return undefined;
  const up = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === up);
}

export function countryName(code: string | null | undefined, lang: string): string {
  const c = getCountry(code);
  if (!c) return code ?? "";
  return lang.startsWith("pl") ? c.name_pl : c.name_en;
}

export function sortedCountries(lang: string): Country[] {
  const key: keyof Country = lang.startsWith("pl") ? "name_pl" : "name_en";
  return [...COUNTRIES].sort((a, b) =>
    String(a[key]).localeCompare(String(b[key]), lang),
  );
}

/**
 * Wybór kraju domyślnego wg priorytetów:
 *  1. jawnie podany profileCountry (np. address_country z profilu)
 *  2. mapowanie z języka i18next
 *  3. fallback "PL"
 */
export function pickDefaultCountry(
  profileCountry?: string | null,
  lang?: string,
): CountryCode {
  const fromProfile = getCountry(profileCountry);
  if (fromProfile) return fromProfile.code;
  const langKey = (lang ?? "pl").slice(0, 2).toLowerCase();
  return LANG_TO_COUNTRY[langKey] ?? "PL";
}

/**
 * Próbuje rozbić zapisany numer "+48 123 456 789" na (countryCode, localNumber).
 * Dopasowuje najdłuższy pasujący prefiks. Zwraca null jeśli nie da się dopasować.
 */
export function parsePhone(
  raw: string | null | undefined,
): { country: CountryCode; national: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) return null;
  const digits = trimmed.slice(1).replace(/\s+/g, "");
  const candidates = [...COUNTRIES]
    .filter((c) => digits.startsWith(c.dial))
    .sort((a, b) => b.dial.length - a.dial.length);
  if (candidates.length === 0) return null;
  const c = candidates[0];
  return { country: c.code, national: digits.slice(c.dial.length) };
}

/** Składa pełny numer w formacie "+<dial> <national>" (po przefiltrowaniu spacji). */
export function formatPhone(country: CountryCode, national: string): string {
  const c = getCountry(country);
  const cleaned = national.replace(/[^\d\s-]/g, "").trim();
  if (!c) return cleaned;
  if (!cleaned) return "";
  return `+${c.dial} ${cleaned}`;
}
