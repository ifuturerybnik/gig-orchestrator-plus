// ============================================================================
// Concertivo — waluty świata (ISO 4217)
// ============================================================================
// Lista ~50 najczęściej używanych walut + mapowanie kraj → waluta.
// Używana w module budżetu organizacji.

export interface Currency {
  code: string; // ISO 4217, np. "PLN"
  name_pl: string;
  name_en: string;
  symbol: string;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "PLN", name_pl: "Złoty polski", name_en: "Polish złoty", symbol: "zł" },
  { code: "EUR", name_pl: "Euro", name_en: "Euro", symbol: "€" },
  { code: "USD", name_pl: "Dolar amerykański", name_en: "US dollar", symbol: "$" },
  { code: "GBP", name_pl: "Funt brytyjski", name_en: "Pound sterling", symbol: "£" },
  { code: "CHF", name_pl: "Frank szwajcarski", name_en: "Swiss franc", symbol: "CHF" },
  { code: "CZK", name_pl: "Korona czeska", name_en: "Czech koruna", symbol: "Kč" },
  { code: "SEK", name_pl: "Korona szwedzka", name_en: "Swedish krona", symbol: "kr" },
  { code: "NOK", name_pl: "Korona norweska", name_en: "Norwegian krone", symbol: "kr" },
  { code: "DKK", name_pl: "Korona duńska", name_en: "Danish krone", symbol: "kr" },
  { code: "ISK", name_pl: "Korona islandzka", name_en: "Icelandic króna", symbol: "kr" },
  { code: "HUF", name_pl: "Forint węgierski", name_en: "Hungarian forint", symbol: "Ft" },
  { code: "RON", name_pl: "Lej rumuński", name_en: "Romanian leu", symbol: "lei" },
  { code: "BGN", name_pl: "Lew bułgarski", name_en: "Bulgarian lev", symbol: "лв" },
  { code: "HRK", name_pl: "Kuna chorwacka", name_en: "Croatian kuna", symbol: "kn" },
  { code: "RSD", name_pl: "Dinar serbski", name_en: "Serbian dinar", symbol: "дин" },
  { code: "BAM", name_pl: "Marka zamienna", name_en: "Bosnian mark", symbol: "KM" },
  { code: "MKD", name_pl: "Denar macedoński", name_en: "Macedonian denar", symbol: "ден" },
  { code: "ALL", name_pl: "Lek albański", name_en: "Albanian lek", symbol: "L" },
  { code: "TRY", name_pl: "Lira turecka", name_en: "Turkish lira", symbol: "₺" },
  { code: "UAH", name_pl: "Hrywna ukraińska", name_en: "Ukrainian hryvnia", symbol: "₴" },
  { code: "BYN", name_pl: "Rubel białoruski", name_en: "Belarusian ruble", symbol: "Br" },
  { code: "RUB", name_pl: "Rubel rosyjski", name_en: "Russian ruble", symbol: "₽" },
  { code: "CAD", name_pl: "Dolar kanadyjski", name_en: "Canadian dollar", symbol: "C$" },
  { code: "MXN", name_pl: "Peso meksykańskie", name_en: "Mexican peso", symbol: "$" },
  { code: "BRL", name_pl: "Real brazylijski", name_en: "Brazilian real", symbol: "R$" },
  { code: "ARS", name_pl: "Peso argentyńskie", name_en: "Argentine peso", symbol: "$" },
  { code: "CLP", name_pl: "Peso chilijskie", name_en: "Chilean peso", symbol: "$" },
  { code: "COP", name_pl: "Peso kolumbijskie", name_en: "Colombian peso", symbol: "$" },
  { code: "AUD", name_pl: "Dolar australijski", name_en: "Australian dollar", symbol: "A$" },
  { code: "NZD", name_pl: "Dolar nowozelandzki", name_en: "New Zealand dollar", symbol: "NZ$" },
  { code: "JPY", name_pl: "Jen japoński", name_en: "Japanese yen", symbol: "¥" },
  { code: "KRW", name_pl: "Won południowokoreański", name_en: "South Korean won", symbol: "₩" },
  { code: "CNY", name_pl: "Juan chiński", name_en: "Chinese yuan", symbol: "¥" },
  { code: "HKD", name_pl: "Dolar Hongkongu", name_en: "Hong Kong dollar", symbol: "HK$" },
  { code: "TWD", name_pl: "Dolar tajwański", name_en: "Taiwan dollar", symbol: "NT$" },
  { code: "SGD", name_pl: "Dolar singapurski", name_en: "Singapore dollar", symbol: "S$" },
  { code: "THB", name_pl: "Bat tajski", name_en: "Thai baht", symbol: "฿" },
  { code: "IDR", name_pl: "Rupia indonezyjska", name_en: "Indonesian rupiah", symbol: "Rp" },
  { code: "MYR", name_pl: "Ringgit malezyjski", name_en: "Malaysian ringgit", symbol: "RM" },
  { code: "PHP", name_pl: "Peso filipińskie", name_en: "Philippine peso", symbol: "₱" },
  { code: "VND", name_pl: "Dong wietnamski", name_en: "Vietnamese đồng", symbol: "₫" },
  { code: "INR", name_pl: "Rupia indyjska", name_en: "Indian rupee", symbol: "₹" },
  { code: "PKR", name_pl: "Rupia pakistańska", name_en: "Pakistani rupee", symbol: "₨" },
  { code: "AED", name_pl: "Dirham ZEA", name_en: "UAE dirham", symbol: "د.إ" },
  { code: "SAR", name_pl: "Rial saudyjski", name_en: "Saudi riyal", symbol: "﷼" },
  { code: "QAR", name_pl: "Rial katarski", name_en: "Qatari riyal", symbol: "﷼" },
  { code: "ILS", name_pl: "Szekel izraelski", name_en: "Israeli shekel", symbol: "₪" },
  { code: "EGP", name_pl: "Funt egipski", name_en: "Egyptian pound", symbol: "£" },
  { code: "ZAR", name_pl: "Rand południowoafrykański", name_en: "South African rand", symbol: "R" },
  { code: "NGN", name_pl: "Naira nigeryjska", name_en: "Nigerian naira", symbol: "₦" },
  { code: "MAD", name_pl: "Dirham marokański", name_en: "Moroccan dirham", symbol: "د.م." },
];

// Mapowanie kraj (ISO-2) → waluta (ISO 4217)
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  PL: "PLN", DE: "EUR", CZ: "CZK", SK: "EUR", UA: "UAH", LT: "EUR",
  LV: "EUR", EE: "EUR", BY: "BYN", AT: "EUR", CH: "CHF", FR: "EUR",
  BE: "EUR", NL: "EUR", LU: "EUR", GB: "GBP", IE: "EUR", ES: "EUR",
  PT: "EUR", IT: "EUR", DK: "DKK", SE: "SEK", NO: "NOK", FI: "EUR",
  IS: "ISK", HU: "HUF", RO: "RON", BG: "BGN", GR: "EUR", HR: "EUR",
  SI: "EUR", RS: "RSD", BA: "BAM", ME: "EUR", MK: "MKD", AL: "ALL",
  TR: "TRY", MT: "EUR", CY: "EUR", US: "USD", CA: "CAD", MX: "MXN",
  BR: "BRL", AR: "ARS", AU: "AUD", NZ: "NZD", JP: "JPY", KR: "KRW",
  CN: "CNY", IN: "INR", AE: "AED", IL: "ILS", ZA: "ZAR",
};

export function getCurrency(code?: string | null): Currency | undefined {
  if (!code) return undefined;
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}

export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return "PLN";
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "PLN";
}

export function sortedCurrencies(lang: string): Currency[] {
  const key: keyof Currency = lang.startsWith("pl") ? "name_pl" : "name_en";
  return [...CURRENCIES].sort((a, b) =>
    String(a[key]).localeCompare(String(b[key]), lang),
  );
}

export function formatAmount(
  amount: number,
  currency: string,
  lang: string = "pl",
): string {
  try {
    return new Intl.NumberFormat(lang.startsWith("pl") ? "pl-PL" : "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
