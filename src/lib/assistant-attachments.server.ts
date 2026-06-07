// Server-only helpery do obsługi załączników (obrazy + PDF) w Asystencie.
// Pliki NIE są zapisywane — przetwarzamy je w pamięci na czas pojedynczej wiadomości.

import { extractText, getDocumentProxy } from "unpdf";

export type AttachmentInput = {
  name: string;
  mimeType: string;
  /** base64 (bez prefiksu data:...). */
  dataBase64: string;
};

export type ImageAttachmentPart = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};

export type ProcessedAttachments = {
  /** Multimodalne części do osadzenia w content użytkownika. */
  imageParts: ImageAttachmentPart[];
  /** Wyciągnięty tekst z PDF-ów, gotowy do doklejenia jako tekst. */
  pdfText: string;
  /** Krótki opis dla zapisu w historii (bez bajtów). */
  summary: string;
};

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const PDF_PAGE_LIMIT = 20;
const PDF_TEXT_LIMIT = 60_000; // znaki — twarda granica zabezpieczająca koszty

const ALLOWED_IMAGE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ALLOWED_PDF = "application/pdf";

function bytesFromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  // atob jest dostępne w Workerze i Node 18+
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function extractPdfText(bytes: Uint8Array, fileName: string): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const totalPages = pdf.numPages;
  const truncated = totalPages > PDF_PAGE_LIMIT;
  const { text } = await extractText(pdf, { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [String(text ?? "")];
  let combined = "";
  for (let i = 0; i < Math.min(pages.length, PDF_PAGE_LIMIT); i++) {
    combined += `\n\n--- Strona ${i + 1} ---\n${(pages[i] ?? "").trim()}`;
    if (combined.length > PDF_TEXT_LIMIT) break;
  }
  let out = combined.trim();
  if (out.length > PDF_TEXT_LIMIT) out = out.slice(0, PDF_TEXT_LIMIT) + "\n…[obcięto]";
  return (
    `[ZAŁĄCZNIK PDF · ${fileName} · ${totalPages} stron${truncated ? `, przetworzono pierwsze ${PDF_PAGE_LIMIT}` : ""}]\n` +
    (out || "[Brak warstwy tekstowej w PDF — prawdopodobnie skan, OCR niedostępny w MVP.]")
  );
}

/**
 * Waliduje i przetwarza listę załączników.
 * Rzuca błędem dla każdego naruszenia limitów (rozmiar/typ/liczba).
 */
export async function processAttachments(
  attachments: AttachmentInput[],
): Promise<ProcessedAttachments> {
  if (!attachments.length) return { imageParts: [], pdfText: "", summary: "" };
  if (attachments.length > MAX_FILES) {
    throw new Error(`Maksymalnie ${MAX_FILES} pliki na wiadomość.`);
  }

  const imageParts: ImageAttachmentPart[] = [];
  const pdfTexts: string[] = [];
  const summaryItems: string[] = [];

  for (const att of attachments) {
    const mime = (att.mimeType || "").toLowerCase();
    const isImage = ALLOWED_IMAGE.has(mime);
    const isPdf = mime === ALLOWED_PDF;
    if (!isImage && !isPdf) {
      throw new Error(`Nieobsługiwany typ pliku: ${att.name} (${mime}).`);
    }
    // Szacujemy rozmiar po długości base64 (≈ 0.75 × długość)
    const approxBytes = Math.floor((att.dataBase64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      throw new Error(
        `Plik „${att.name}" przekracza limit 5 MB (${(approxBytes / 1024 / 1024).toFixed(1)} MB).`,
      );
    }

    if (isImage) {
      const dataUrl = `data:${mime};base64,${att.dataBase64.replace(/^data:[^;]+;base64,/, "")}`;
      imageParts.push({ type: "image_url", image_url: { url: dataUrl, detail: "auto" } });
      summaryItems.push(`🖼️ ${att.name}`);
    } else {
      const bytes = bytesFromBase64(att.dataBase64);
      const txt = await extractPdfText(bytes, att.name);
      pdfTexts.push(txt);
      summaryItems.push(`📄 ${att.name}`);
    }
  }

  return {
    imageParts,
    pdfText: pdfTexts.join("\n\n"),
    summary: summaryItems.join(", "),
  };
}
