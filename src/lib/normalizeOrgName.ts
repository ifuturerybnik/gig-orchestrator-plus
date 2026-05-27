// Klient-side normalizacja nazwy organizacji. Musi dawać taki sam wynik jak
// public.normalize_org_name() w SQL (migracja 0020). Używana do podpowiedzi
// w UI; finalne porównanie i tak robi DB.

const LEGAL_FORMS_REGEX: RegExp[] = [
  /\bsp(olka)?\.?\s*z\s*o\.?\s*o\.?\b/gi,
  /\bspolka z ograniczona odpowiedzialnoscia\b/gi,
  /\b(s\.?\s*a\.?|spolka akcyjna)\b/gi,
  /\b(sp\.?\s*k\.?|sp\.?\s*j\.?|sp\.?\s*p\.?)\b/gi,
  /\b(p\.?\s*p\.?\s*h\.?\s*u\.?|p\.?\s*h\.?\s*u\.?|f\.?\s*h\.?\s*u\.?)\b/gi,
  /\b(ltd|llc|inc|gmbh|ag|kft|s\.?r\.?o\.?|s\.?r\.?l\.?|bv|nv|oy|ab|as|plc|corp|co)\b/gi,
];

export function normalizeOrgName(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.toLowerCase();
  // ł → l (NFD nie rozkłada tej litery)
  s = s.replace(/ł/g, "l").replace(/Ł/g, "l");
  // pozostałe diakrytyki
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // formy prawne
  for (const re of LEGAL_FORMS_REGEX) s = s.replace(re, " ");
  // tylko [a-z0-9 ]
  s = s.replace(/[^a-z0-9 ]+/g, " ");
  // collapse spacji
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
