// Generuje raport PDF ze skanu GUS.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export function downloadGusScanReportPdf(job: GusScanReportJob) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text("Raport skanowania GUS REGON (BIR1.1)", 40, 50);
  doc.setFontSize(10);
  const meta = [
    `Zlecenie: ${job.id}`,
    `Identyfikator wyszukiwania: ${job.identifier.toUpperCase()}`,
    `Pola uzupełniane: ${job.fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`,
    `Utworzono: ${new Date(job.created_at).toLocaleString("pl-PL")}`,
    `Zakończono: ${job.finished_at ? new Date(job.finished_at).toLocaleString("pl-PL") : "—"}`,
    `Łącznie: ${job.total} · Zaktualizowano: ${job.updated_count} · Pominięto: ${job.skipped_count} · Błędy: ${job.error_count}`,
  ];
  doc.text(meta, 40, 72);

  // Tabela zbiorcza
  autoTable(doc, {
    startY: 170,
    head: [["#", "Nazwa", "Wynik", "Szczegóły"]],
    body: job.changes.map((c, i) => {
      let details = "";
      if (c.result === "updated" && c.fields) {
        details = Object.entries(c.fields)
          .map(([k, v]) => `${FIELD_LABEL[k] ?? k}: "${v.from ?? "—"}" → "${v.to ?? "—"}"`)
          .join("\n");
      } else if (c.reason) {
        details = c.reason;
      }
      return [String(i + 1), c.name ?? "—", c.result, details];
    }),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [60, 60, 60] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 180 },
      2: { cellWidth: 70 },
      3: { cellWidth: W - 40 - 40 - 28 - 180 - 70 },
    },
    margin: { left: 40, right: 40 },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  doc.save(`gus-scan-${stamp}.pdf`);
}
