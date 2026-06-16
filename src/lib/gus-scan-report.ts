import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

export type GusScanReportJob = {
  id: string;
  identifier: "nip" | "regon" | "krs";
  fields: string[];
  total: number;
  processed: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  created_at: string;
  finished_at: string | null;
  changes: Array<{
    entity_id: string;
    name: string | null;
    result: "updated" | "skipped" | "error";
    fields?: Record<string, { from: string | null; to: string | null }>;
    reason?: string;
  }>;
};

const FIELD_LABEL: Record<string, string> = {
  nip: "NIP",
  regon: "REGON",
  krs: "KRS",
  name: "Nazwa",
  wojewodztwo: "Województwo",
  powiat: "Powiat",
  gmina: "Gmina",
  miejscowosc: "Miejscowość",
  kod_pocztowy: "Kod poczt.",
  poczta: "Poczta",
  ulica: "Ulica",
  nr_domu: "Nr",
};

let fontsLoaded = false;

function ensureFonts() {
  if (fontsLoaded) return;
  pdfMake.addVirtualFileSystem(pdfFonts);
  fontsLoaded = true;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pl-PL") : "—";
}

function valueText(value: string | null | undefined) {
  return value && value.trim() ? value : "—";
}

function resultLabel(result: "updated" | "skipped" | "error") {
  if (result === "updated") return "Zaktualizowano";
  if (result === "error") return "Błąd";
  return "Pominięto";
}

function resultColor(result: "updated" | "skipped" | "error") {
  if (result === "updated") return "#137A3A";
  if (result === "error") return "#B42318";
  return "#667085";
}

function badge(text: string, color: string): TableCell {
  return {
    text,
    color,
    bold: true,
    fontSize: 8,
    margin: [0, 2, 0, 2],
  };
}

function metaCell(label: string, value: string): TableCell {
  return {
    stack: [
      { text: label, style: "metaLabel" },
      { text: value, style: "metaValue" },
    ],
    fillColor: "#F8FAFC",
    margin: [8, 7, 8, 7],
  };
}

function changeRows(job: GusScanReportJob): TableCell[][] {
  const rows: TableCell[][] = [];

  job.changes.forEach((change, index) => {
    const common: TableCell[] = [
      { text: String(index + 1), style: "rowIndex" },
      { text: valueText(change.name), style: "entityName" },
      badge(resultLabel(change.result), resultColor(change.result)),
    ];

    if (change.result === "updated" && change.fields && Object.keys(change.fields).length > 0) {
      const entries = Object.entries(change.fields);
      entries.forEach(([field, diff], diffIndex) => {
        rows.push([
          ...(diffIndex === 0 ? common : [{ text: "" }, { text: "" }, { text: "" }]),
          { text: FIELD_LABEL[field] ?? field, style: "fieldName" },
          { text: valueText(diff.from), style: "beforeValue" },
          { text: valueText(diff.to), style: "afterValue" },
        ]);
      });
      return;
    }

    rows.push([
      ...common,
      { text: "—", style: "muted" },
      { text: change.reason ?? "Bez zmian", colSpan: 2, style: "muted" },
      {},
    ]);
  });

  return rows.length > 0
    ? rows
    : [[{ text: "—" }, { text: "Brak rekordów w raporcie", colSpan: 5, style: "muted" }, {}, {}, {}, {}]];
}

export function createGusScanReportDefinition(job: GusScanReportJob): TDocumentDefinitions {
  const content: Content[] = [
    { text: "Raport skanowania GUS REGON (BIR1.1)", style: "title" },
    { text: `Zlecenie ${job.id}`, style: "subtitle" },
    {
      table: {
        widths: ["25%", "25%", "25%", "25%"],
        body: [
          [
            metaCell("Skanuj po", job.identifier.toUpperCase()),
            metaCell("Utworzono", formatDate(job.created_at)),
            metaCell("Zakończono", formatDate(job.finished_at)),
            metaCell("Przetworzono", `${job.processed}/${job.total}`),
          ],
          [
            metaCell("Zaktualizowano", String(job.updated_count)),
            metaCell("Pominięto", String(job.skipped_count)),
            metaCell("Błędy", String(job.error_count)),
            metaCell("Pola", job.fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")),
          ],
        ],
      },
      layout: {
        hLineColor: () => "#E4E7EC",
        vLineColor: () => "#E4E7EC",
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 14, 0, 16],
    },
    { text: "Zmiany w rekordach", style: "sectionTitle" },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [22, 132, 78, 74, 122, 122],
        body: [
          [
            { text: "#", style: "tableHeader" },
            { text: "Rekord", style: "tableHeader" },
            { text: "Wynik", style: "tableHeader" },
            { text: "Pole", style: "tableHeader" },
            { text: "Przed zmianą", style: "tableHeader" },
            { text: "Po zmianie", style: "tableHeader" },
          ],
          ...changeRows(job),
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? "#344054" : rowIndex % 2 === 0 ? "#FCFCFD" : null),
        hLineColor: () => "#EAECF0",
        vLineColor: () => "#EAECF0",
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
    },
  ];

  return {
    info: {
      title: "Raport skanowania GUS REGON (BIR1.1)",
      author: "Concertivo",
      subject: "Raport zmian w Bazie PP",
    },
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 34, 28, 32],
    defaultStyle: { font: "Roboto", fontSize: 8.5, color: "#101828" },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "Concertivo · Baza PP", color: "#98A2B3" },
        { text: `Strona ${currentPage}/${pageCount}`, alignment: "right", color: "#98A2B3" },
      ],
      margin: [28, 0, 28, 0],
      fontSize: 8,
    }),
    styles: {
      title: { fontSize: 16, bold: true, color: "#101828" },
      subtitle: { fontSize: 8, color: "#667085", margin: [0, 4, 0, 0] },
      sectionTitle: { fontSize: 11, bold: true, margin: [0, 0, 0, 8] },
      metaLabel: { fontSize: 7, color: "#667085" },
      metaValue: { fontSize: 9, bold: true, color: "#101828", margin: [0, 2, 0, 0] },
      tableHeader: { bold: true, color: "#FFFFFF", fontSize: 8 },
      rowIndex: { color: "#667085", alignment: "right" },
      entityName: { bold: true, fontSize: 8.2 },
      fieldName: { color: "#344054", bold: true },
      beforeValue: { color: "#7A271A" },
      afterValue: { color: "#05603A", bold: true },
      muted: { color: "#667085" },
    },
    content,
  };
}

export function downloadGusScanReportPdf(job: GusScanReportJob) {
  ensureFonts();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  pdfMake.createPdf(createGusScanReportDefinition(job)).download(`gus-scan-${stamp}.pdf`);
}