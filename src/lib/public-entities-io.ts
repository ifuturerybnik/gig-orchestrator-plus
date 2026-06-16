// Klient-side parsery do importu Bazy PP.
// Mapują surowe nagłówki dwóch typowych źródeł na nasz schemat:
// 1) "JST" — Baza_teleadresowa_jst_w_Polsce_*.xls (kolumny po polsku z Kod_TERYT itd.)
// 2) "Ośrodki kultury" — osrodki_kultury.csv (woj, Nazwa ośrodka, ulica, numer, kod pocztowy, miejscowość, www)
// 3) "Generyczny" — autodetect po nazwach kolumn, najlepszy fit.
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { PublicEntityType } from "@/lib/public-entities.functions";

export type ImportSource = "jst" | "osrodki_kultury" | "generic";

export interface ParsedRow {
  entity_type: PublicEntityType;
  name: string;
  short_name?: string | null;
  teryt_code?: string | null;
  jst_type_raw?: string | null;
  wojewodztwo?: string | null;
  powiat?: string | null;
  gmina?: string | null;
  miejscowosc?: string | null;
  kod_pocztowy?: string | null;
  poczta?: string | null;
  ulica?: string | null;
  nr_domu?: string | null;
  phone?: string | null;
  phone_ext?: string | null;
  nip?: string | null;
  regon?: string | null;
  krs?: string | null;
  email?: string | null;
  www?: string | null;
  epuap_address?: string | null;
  edoreczenia_ade?: string | null;
}


function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" || str.toLowerCase() === "nan" ? null : str;
}

function lowerWoj(v: unknown): string | null {
  const x = s(v);
  return x ? x.toLowerCase() : null;
}

function joinPhone(kier: unknown, num: unknown): string | null {
  const k = s(kier)?.replace(/\D/g, "");
  const n = s(num)?.replace(/\D/g, "");
  if (!n) return null;
  let out = "+48 ";
  if (k) out += k + " ";
  out += n;
  return out;
}

function phoneExt(wew: unknown): string | null {
  const w = s(wew)?.replace(/\D/g, "");
  return w || null;
}

function jstTypeMap(raw: unknown): PublicEntityType {
  const t = (s(raw) ?? "").toUpperCase();
  if (t === "W") return "jst_wojewodztwo";
  if (t === "P") return "jst_powiat";
  return "jst_gmina"; // G, M, Gw, GW i wszystko inne traktujemy jak gminę
}

function mapJstRow(r: Record<string, unknown>): ParsedRow | null {
  const name = s(r["nazwa_urzędu_JST"]) ?? s(r["nazwa_samorządu"]);
  if (!name) return null;
  return {
    entity_type: jstTypeMap(r["typ_JST"]),
    name,
    short_name: s(r["nazwa_samorządu"]),
    teryt_code: s(r["Kod_TERYT"]),
    jst_type_raw: s(r["typ_JST"]),
    wojewodztwo: lowerWoj(r["Województwo"]),
    powiat: s(r["Powiat"])?.toLowerCase() ?? null,
    gmina: s(r["Gmina"] ?? r["gmina"])?.toLowerCase() ?? null,
    miejscowosc: s(r["miejscowość"]),

    kod_pocztowy: s(r["Kod pocztowy"]),
    poczta: s(r["poczta"]),
    ulica: s(r["Ulica"]),
    nr_domu: s(r["Nr domu"]),
    phone: joinPhone(r["telefon kierunkowy"], r["telefon"]),
    phone_ext: phoneExt(r["wewnętrzny"]),
    nip: s(r["NIP"] ?? r["nip"]),
    regon: s(r["REGON"] ?? r["regon"]),
    email: s(r["ogólny adres poczty elektronicznej gminy/powiatu/województwa"]),
    www: s(r["adres www jednostki"]),
    epuap_address: s(r["ESP"]),
    edoreczenia_ade: s(r["adres doręczeń elektronicznych ADE"]),
  };
}

function mapOsrodekRow(r: Record<string, unknown>): ParsedRow | null {
  const name = s(r["Nazwa ośrodka"]) ?? s(r["nazwa"]) ?? s(r["Nazwa"]);
  if (!name) return null;
  const ulicaRaw = s(r["ulica"]);
  const nrRaw = s(r["numer"]) ?? s(r["nr"]);
  return {
    entity_type: "osrodek_kultury",
    name,
    wojewodztwo: lowerWoj(r["województwo"] ?? r["Województwo"]),
    miejscowosc: s(r["miejscowość"] ?? r["Miejscowość"]),
    kod_pocztowy: s(r["kod pocztowy"] ?? r["Kod pocztowy"]),
    ulica: ulicaRaw,
    nr_domu: nrRaw,
    www: s(r["strona www"] ?? r["www"] ?? r["WWW"]),
    nip: s(r["NIP"] ?? r["nip"]),
    regon: s(r["REGON"] ?? r["regon"]),
  };
}

function mapGenericRow(r: Record<string, unknown>): ParsedRow | null {
  // Próbuj jst → potem osrodek
  if ("Kod_TERYT" in r || "typ_JST" in r) return mapJstRow(r);
  if ("Nazwa ośrodka" in r) return mapOsrodekRow(r);
  // Fallback minimalny
  const name = s(r["nazwa"] ?? r["Nazwa"] ?? r["name"]);
  if (!name) return null;
  return {
    entity_type: "osrodek_kultury",
    name,
    wojewodztwo: lowerWoj(r["województwo"] ?? r["wojewodztwo"]),
    miejscowosc: s(r["miejscowość"] ?? r["miejscowosc"]),
  };
}

export async function parseImportFile(
  file: File,
  source: ImportSource,
): Promise<{ rows: ParsedRow[]; skipped: number; rawCount: number }> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type.includes("csv");
  let raw: Record<string, unknown>[];

  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
    });
    raw = parsed.data;
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  }

  const mappers: Array<(r: Record<string, unknown>) => ParsedRow | null> =
    source === "jst"
      ? [mapJstRow, mapOsrodekRow, mapGenericRow]
      : source === "osrodki_kultury"
        ? [mapOsrodekRow, mapJstRow, mapGenericRow]
        : [mapGenericRow, mapJstRow, mapOsrodekRow];

  // Auto-fallback: jeśli wybrany mapper pomija WSZYSTKIE wiersze, spróbuj kolejnym.
  let rows: ParsedRow[] = [];
  let skipped = 0;
  for (const mapper of mappers) {
    rows = [];
    skipped = 0;
    for (const r of raw) {
      const mapped = mapper(r);
      if (mapped) rows.push(mapped);
      else skipped++;
    }
    if (rows.length > 0) break;
  }
  return { rows, skipped, rawCount: raw.length };
}

// === EXPORT ===
export type ExportRow = Record<string, unknown>;

const EXPORT_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "entity_type", label: "Typ" },
  { key: "name", label: "Nazwa" },
  { key: "short_name", label: "Nazwa skrócona" },
  { key: "teryt_code", label: "Kod TERYT" },
  { key: "jst_type_raw", label: "Typ JST (oryg.)" },
  { key: "wojewodztwo", label: "Województwo" },
  { key: "powiat", label: "Powiat" },
  { key: "miejscowosc", label: "Miejscowość" },
  { key: "kod_pocztowy", label: "Kod pocztowy" },
  { key: "poczta", label: "Poczta" },
  { key: "ulica", label: "Ulica" },
  { key: "nr_domu", label: "Nr domu" },
  { key: "phone", label: "Telefon" },
  { key: "phone_ext", label: "Nr wewnętrzny" },
  { key: "nip", label: "NIP" },
  { key: "regon", label: "REGON" },
  { key: "email", label: "Email" },
  { key: "www", label: "WWW" },
  { key: "epuap_address", label: "ePUAP" },
  { key: "edoreczenia_ade", label: "e-Doręczenia (ADE)" },
];

function toExportRows(rows: ExportRow[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of EXPORT_COLUMNS) o[c.label] = r[c.key] ?? "";
    return o;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportToXlsx(rows: ExportRow[], filename = "baza-pp.xlsx") {
  const data = toExportRows(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Baza PP");
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  triggerDownload(new Blob([arr], { type: "application/octet-stream" }), filename);
}

export function exportToCsv(rows: ExportRow[], filename = "baza-pp.csv") {
  const data = toExportRows(rows);
  const csv = Papa.unparse(data, { header: true });
  triggerDownload(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}
