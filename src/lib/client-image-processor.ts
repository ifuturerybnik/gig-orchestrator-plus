// Client-side image processor (browser-only, Canvas API).
// Wejście: File (JPG/PNG/WebP/HEIC jeśli przeglądarka wspiera).
// Wyjście: 3 warianty WebP — original / medium / thumb.

export interface ImageVariant {
  variant: "original" | "medium" | "thumb";
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
}

export interface ProcessedImage {
  uploadId: string;
  sourceName: string;
  variants: ImageVariant[];
}

const TARGETS = {
  original: { maxSide: 2560, quality: 0.85 },
  medium: { maxSide: 1280, quality: 0.82 },
  thumb: { maxSide: 400, quality: 0.8, square: true },
} as const;

function genId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się odczytać pliku obrazu."));
    };
    img.src = url;
  });
}

function fitInto(
  srcW: number,
  srcH: number,
  maxSide: number,
): { w: number; h: number } {
  if (srcW <= maxSide && srcH <= maxSide) return { w: srcW, h: srcH };
  if (srcW >= srcH) {
    const w = maxSide;
    const h = Math.round((srcH / srcW) * maxSide);
    return { w, h };
  }
  const h = maxSide;
  const w = Math.round((srcW / srcH) * maxSide);
  return { w, h };
}

async function canvasToWebP(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Konwersja do WebP nieudana."))),
      "image/webp",
      quality,
    );
  });
}

async function renderVariant(
  img: HTMLImageElement,
  spec: { maxSide: number; quality: number; square?: boolean },
): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak kontekstu 2D.");

  if (spec.square) {
    // smart center-crop kwadrat
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const target = Math.min(spec.maxSide, side);
    canvas.width = target;
    canvas.height = target;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
    const blob = await canvasToWebP(canvas, spec.quality);
    return { blob, width: target, height: target };
  }
  const { w, h } = fitInto(img.naturalWidth, img.naturalHeight, spec.maxSide);
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToWebP(canvas, spec.quality);
  return { blob, width: w, height: h };
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("To nie jest obraz.");
  }
  const img = await loadImage(file);

  const original = await renderVariant(img, TARGETS.original);
  const medium = await renderVariant(img, TARGETS.medium);
  const thumb = await renderVariant(img, TARGETS.thumb);

  return {
    uploadId: genId(),
    sourceName: file.name,
    variants: [
      {
        variant: "original",
        blob: original.blob,
        width: original.width,
        height: original.height,
        contentType: "image/webp",
      },
      {
        variant: "medium",
        blob: medium.blob,
        width: medium.width,
        height: medium.height,
        contentType: "image/webp",
      },
      {
        variant: "thumb",
        blob: thumb.blob,
        width: thumb.width,
        height: thumb.height,
        contentType: "image/webp",
      },
    ],
  };
}
