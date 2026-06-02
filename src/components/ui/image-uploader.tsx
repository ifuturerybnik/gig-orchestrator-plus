// Globalny komponent uploadu obrazów dla modułów Web.
// Drag-drop + klik. Po stronie klienta: resize/konwersja do WebP (3 warianty),
// presign uploadu R2, równoległy PUT, confirm.

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processImage } from "@/lib/client-image-processor";
import {
  presignWebImageUpload,
  confirmWebImageUpload,
  deleteWebImageObject,
} from "@/lib/web-uploads.functions";

export interface UploadedImage {
  originalId: string;
  originalUrl: string;
  mediumUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface ImageUploaderProps {
  organizationId: string;
  module: "web-news" | "web-events" | "web-gallery";
  multiple?: boolean;
  // Dla pojedynczego trybu: kontrolowany.
  value?: UploadedImage | null;
  // Dla pojedynczego trybu: wywoływane po udanym uploadzie / wyczyszczeniu.
  onChange?: (img: UploadedImage | null) => void;
  // Dla wielokrotnego trybu (galeria): wywoływane po każdym uploadzie.
  onUploaded?: (img: UploadedImage) => void;
  className?: string;
  // Etykieta nad polem (opcjonalna).
  label?: string;
}

type Job = {
  id: string;
  name: string;
  status: "processing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  preview?: string;
};

export function ImageUploader({
  organizationId,
  module,
  multiple = false,
  value = null,
  onChange,
  onUploaded,
  className,
  label,
}: ImageUploaderProps) {
  const { t } = useTranslation();
  const presign = useServerFn(presignWebImageUpload);
  const confirm = useServerFn(confirmWebImageUpload);
  const delObj = useServerFn(deleteWebImageObject);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isDrag, setIsDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (file: File) => {
      const jobId = Math.random().toString(36).slice(2);
      const preview = URL.createObjectURL(file);
      setJobs((s) => [
        ...s,
        { id: jobId, name: file.name, status: "processing", progress: 0, preview },
      ]);
      try {
        const processed = await processImage(file);
        setJobs((s) =>
          s.map((j) => (j.id === jobId ? { ...j, status: "uploading", progress: 10 } : j)),
        );

        const presigned = await presign({
          data: {
            organization_id: organizationId,
            module,
            upload_id: processed.uploadId,
            variants: processed.variants.map((v) => ({
              variant: v.variant,
              content_type: v.contentType,
              size_bytes: v.blob.size,
              width: v.width,
              height: v.height,
            })),
          },
        });

        // PUT wszystkich wariantów równolegle
        await Promise.all(
          processed.variants.map(async (v) => {
            const target = presigned.variants.find((p) => p.variant === v.variant);
            if (!target) throw new Error(`Brak presign dla wariantu ${v.variant}`);
            const res = await fetch(target.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": v.contentType },
              body: v.blob,
            });
            if (!res.ok) throw new Error(`Upload ${v.variant}: HTTP ${res.status}`);
          }),
        );

        await confirm({
          data: { object_ids: presigned.variants.map((p) => p.object_id) },
        });

        const orig = presigned.variants.find((p) => p.variant === "original")!;
        const med = presigned.variants.find((p) => p.variant === "medium")!;
        const th = presigned.variants.find((p) => p.variant === "thumb")!;
        const origVar = processed.variants.find((v) => v.variant === "original")!;
        const result: UploadedImage = {
          originalId: orig.object_id,
          originalUrl: orig.publicUrl,
          mediumUrl: med.publicUrl,
          thumbUrl: th.publicUrl,
          width: origVar.width,
          height: origVar.height,
        };

        setJobs((s) =>
          s.map((j) => (j.id === jobId ? { ...j, status: "done", progress: 100 } : j)),
        );
        if (multiple) {
          onUploaded?.(result);
        } else {
          onChange?.(result);
        }
        // Usuń job z UI po krótkim opóźnieniu
        setTimeout(
          () => setJobs((s) => s.filter((j) => j.id !== jobId)),
          multiple ? 1500 : 400,
        );
      } catch (e) {
        const msg = (e as Error).message;
        setJobs((s) =>
          s.map((j) => (j.id === jobId ? { ...j, status: "error", error: msg } : j)),
        );
        toast.error(msg);
      }
    },
    [confirm, module, multiple, onChange, onUploaded, organizationId, presign],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) {
        toast.error(t("upload.not_an_image"));
        return;
      }
      const list = multiple ? arr : arr.slice(0, 1);
      for (const f of list) {
        void uploadOne(f);
      }
    },
    [multiple, t, uploadOne],
  );

  const removeSingle = useCallback(async () => {
    if (!value) return;
    try {
      await delObj({ data: { object_id: value.originalId } });
    } catch {
      // best-effort
    }
    onChange?.(null);
  }, [delObj, onChange, value]);

  return (
    <div className={className}>
      {label ? <div className="mb-2 text-sm font-medium">{label}</div> : null}

      {/* Single mode: jeśli mamy wartość — pokaż miniaturę */}
      {!multiple && value ? (
        <div className="group relative overflow-hidden rounded-md border border-border">
          <img
            src={value.mediumUrl}
            alt=""
            className="h-48 w-full object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8 opacity-90"
            onClick={removeSingle}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-xs">
            {value.width}×{value.height}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDrag(true);
          }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDrag(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center transition ${
            isDrag
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/50"
          }`}
        >
          <ImagePlus className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("upload.drop_here")}</p>
          <p className="text-xs text-muted-foreground">{t("upload.formats_hint")}</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {jobs.length > 0 && (
        <div className="mt-3 space-y-2">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-2 text-sm"
            >
              {j.preview ? (
                <img src={j.preview} alt="" className="h-10 w-10 rounded object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate">{j.name}</p>
                <p className="text-xs text-muted-foreground">
                  {j.status === "processing" && t("upload.processing")}
                  {j.status === "uploading" && t("upload.uploading")}
                  {j.status === "done" && t("upload.done")}
                  {j.status === "error" && (j.error ?? t("upload.failed"))}
                </p>
              </div>
              {(j.status === "processing" || j.status === "uploading") && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
