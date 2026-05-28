// Concertivo — silnik podstawiania pól dynamicznych w szablonach maili.
// Wzorzec: {{kontakt.imie}}, {{organizacja.nazwa}}, {{data.dzisiaj}} itd.
// Używany w Poczcie (Compose) i Autokorespondencji.

export interface TemplateContext {
  kontakt?: {
    imie?: string | null;
    nazwisko?: string | null;
    email?: string | null;
    firma?: string | null;
    telefon?: string | null;
  };
  kontrahent?: {
    nazwa?: string | null;
    nip?: string | null;
    email?: string | null;
    miasto?: string | null;
  };
  organizacja?: {
    nazwa?: string | null;
    email?: string | null;
  };
  uzytkownik?: {
    imie?: string | null;
    nazwisko?: string | null;
    email?: string | null;
  };
  data?: {
    dzisiaj?: string;
    rok?: string;
  };
  [key: string]: unknown;
}

export interface TemplateVariableDef {
  token: string;
  label: string;
  group: "kontakt" | "kontrahent" | "organizacja" | "uzytkownik" | "data";
}

export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  { token: "{{kontakt.imie}}", label: "Imię kontaktu", group: "kontakt" },
  { token: "{{kontakt.nazwisko}}", label: "Nazwisko kontaktu", group: "kontakt" },
  { token: "{{kontakt.email}}", label: "E-mail kontaktu", group: "kontakt" },
  { token: "{{kontakt.firma}}", label: "Firma kontaktu", group: "kontakt" },
  { token: "{{kontakt.telefon}}", label: "Telefon kontaktu", group: "kontakt" },
  { token: "{{kontrahent.nazwa}}", label: "Nazwa kontrahenta", group: "kontrahent" },
  { token: "{{kontrahent.nip}}", label: "NIP kontrahenta", group: "kontrahent" },
  { token: "{{kontrahent.email}}", label: "E-mail kontrahenta", group: "kontrahent" },
  { token: "{{kontrahent.miasto}}", label: "Miasto kontrahenta", group: "kontrahent" },
  { token: "{{organizacja.nazwa}}", label: "Nazwa organizacji", group: "organizacja" },
  { token: "{{organizacja.email}}", label: "E-mail organizacji", group: "organizacja" },
  { token: "{{uzytkownik.imie}}", label: "Moje imię", group: "uzytkownik" },
  { token: "{{uzytkownik.nazwisko}}", label: "Moje nazwisko", group: "uzytkownik" },
  { token: "{{uzytkownik.email}}", label: "Mój e-mail", group: "uzytkownik" },
  { token: "{{data.dzisiaj}}", label: "Dzisiejsza data", group: "data" },
  { token: "{{data.rok}}", label: "Bieżący rok", group: "data" },
];

function getByPath(ctx: TemplateContext, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function renderTemplate(input: string, ctx: TemplateContext): string {
  if (!input) return input;
  const enriched: TemplateContext = {
    ...ctx,
    data: {
      dzisiaj:
        ctx.data?.dzisiaj ??
        new Date().toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      rok: ctx.data?.rok ?? String(new Date().getFullYear()),
    },
  };
  return input.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path: string) => {
    const v = getByPath(enriched, path);
    return v == null ? "" : String(v);
  });
}
