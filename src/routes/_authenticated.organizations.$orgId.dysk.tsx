import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import {
  HardDrive,
  Folder,
  File as FileIcon,
  Upload,
  FolderPlus,
  Trash2,
  ChevronRight,
  Home,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listDysk,
  createDyskFolder,
  presignDyskUpload,
  confirmDyskUpload,
  deleteDyskEntry,
  getDyskQuota,
  type DyskEntry,
} from "@/lib/dysk.functions";
import { z } from "zod";

const searchSchema = z.object({ path: z.string().optional().catch("") });

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/dysk",
)({
  validateSearch: (s) => searchSchema.parse(s),
  component: DyskPage,
});

function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

function DyskPage() {
  const { t } = useTranslation();
  const { orgId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const path = (search.path ?? "").replace(/^\/+|\/+$/g, "");
  const qc = useQueryClient();

  const fetchList = useServerFn(listDysk);
  const fetchQuota = useServerFn(getDyskQuota);
  const createFolder = useServerFn(createDyskFolder);
  const presign = useServerFn(presignDyskUpload);
  const confirm = useServerFn(confirmDyskUpload);
  const delEntry = useServerFn(deleteDyskEntry);

  const listQ = useQuery({
    queryKey: ["dysk-list", orgId, path],
    queryFn: () => fetchList({ data: { organization_id: orgId, path } }),
  });
  const quotaQ = useQuery({
    queryKey: ["dysk-quota", orgId],
    queryFn: () => fetchQuota({ data: { organization_id: orgId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dysk-list", orgId] });
    qc.invalidateQueries({ queryKey: ["dysk-quota", orgId] });
  };

  // --- new folder dialog
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const folderMut = useMutation({
    mutationFn: (name: string) =>
      createFolder({ data: { organization_id: orgId, path, name } }),
    onSuccess: () => {
      toast.success(t("organizations.dysk.toast.folder_created", { defaultValue: "Folder utworzony" }));
      setFolderOpen(false);
      setFolderName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        setUploading({ name: f.name, pct: 0 });
        const pre = await presign({
          data: {
            organization_id: orgId,
            path,
            filename: f.name,
            content_type: f.type || "application/octet-stream",
            size_bytes: f.size,
          },
        });
        await uploadWithProgress(pre.uploadUrl, f, (pct) =>
          setUploading({ name: f.name, pct }),
        );
        await confirm({ data: { object_id: pre.object_id, size_bytes: f.size } });
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    invalidate();
    toast.success(t("organizations.dysk.toast.uploaded", { defaultValue: "Wgrano pliki" }));
  }

  // --- delete confirm
  const [toDelete, setToDelete] = useState<DyskEntry | null>(null);
  const delMut = useMutation({
    mutationFn: (entry: DyskEntry) =>
      entry.id.startsWith("virtual:")
        ? delEntry({
            data: { organization_id: orgId, folder_path: entry.path },
          })
        : delEntry({ data: { organization_id: orgId, object_id: entry.id } }),
    onSuccess: () => {
      toast.success(t("organizations.dysk.toast.deleted", { defaultValue: "Usunięto" }));
      setToDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const segments = path ? path.split("/") : [];
  const goTo = (p: string) =>
    navigate({ search: { path: p || undefined }, replace: false });

  const quota = quotaQ.data;
  const pct = quota && quota.totalBytes > 0
    ? Math.min(100, (quota.usedBytes / quota.totalBytes) * 100)
    : 0;

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HardDrive className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {t("organizations.sidebar.dysk", { defaultValue: "Dysk" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("organizations.dysk.subtitle", {
              defaultValue:
                "Pliki i foldery tej organizacji w Cloudflare R2.",
            })}
          </p>
        </div>
      </div>

      {/* Quota */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("organizations.dysk.quota.title", { defaultValue: "Zajętość dysku" })}
          </CardTitle>
          <CardDescription>
            {quota
              ? t("organizations.dysk.quota.summary", {
                  defaultValue: "{{used}} z {{total}} ({{pct}}%) — pozostało {{left}}",
                  used: formatBytes(quota.usedBytes),
                  total: formatBytes(quota.totalBytes),
                  pct: pct.toFixed(1),
                  left: formatBytes(quota.remainingBytes),
                })
              : t("common.loading", { defaultValue: "Ładowanie…" })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={pct} />
          {quota && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <div>
                <div className="font-medium text-foreground">{quota.mode === "central" ? "Centralny R2" : "Własny R2"}</div>
                <div>{t("organizations.dysk.quota.mode", { defaultValue: "Tryb" })}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{quota.freeGb} GB</div>
                <div>{t("organizations.dysk.quota.free", { defaultValue: "W abonamencie" })}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{quota.bonusGb} GB</div>
                <div>{t("organizations.dysk.quota.bonus", { defaultValue: "Bonus" })}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{quota.paidGb} GB</div>
                <div>{t("organizations.dysk.quota.paid", { defaultValue: "Dokupione" })}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {t("organizations.dysk.upload", { defaultValue: "Wgraj pliki" })}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button variant="outline" onClick={() => setFolderOpen(true)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          {t("organizations.dysk.new_folder", { defaultValue: "Nowy folder" })}
        </Button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        <button
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => goTo("")}
        >
          <Home className="h-4 w-4" />
          {t("organizations.dysk.root", { defaultValue: "Główny" })}
        </button>
        {segments.map((seg, i) => {
          const sub = segments.slice(0, i + 1).join("/");
          return (
            <span key={sub} className="inline-flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                className="hover:text-foreground text-muted-foreground"
                onClick={() => goTo(sub)}
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {/* Upload progress */}
      {uploading && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate">{uploading.name}</span>
              <span>{uploading.pct.toFixed(0)}%</span>
            </div>
            <Progress value={uploading.pct} className="mt-2" />
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Ładowanie…" })}
            </div>
          ) : listQ.error ? (
            <div className="p-6 text-sm text-destructive">
              {(listQ.error as Error).message}
            </div>
          ) : !listQ.data || listQ.data.entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("organizations.dysk.empty", {
                defaultValue: "Ten folder jest pusty. Wgraj pliki lub utwórz folder.",
              })}
            </div>
          ) : (
            <ul className="divide-y">
              {listQ.data.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"
                >
                  {e.kind === "folder" ? (
                    <button
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => goTo(e.path)}
                    >
                      <Folder className="h-5 w-5 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("organizations.dysk.folder", { defaultValue: "Folder" })}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <>
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(e.size_bytes)}
                          {e.mime ? ` · ${e.mime}` : ""}
                        </div>
                      </div>
                    </>
                  )}
                  {e.kind === "file" && e.public_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      title={t("organizations.dysk.download", { defaultValue: "Otwórz" })}
                    >
                      <a href={e.public_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setToDelete(e)}
                    title={t("common.delete", { defaultValue: "Usuń" })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* New folder dialog */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("organizations.dysk.new_folder", { defaultValue: "Nowy folder" })}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("organizations.dysk.folder_name", {
              defaultValue: "Nazwa folderu",
            })}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && folderName.trim()) {
                folderMut.mutate(folderName.trim());
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              {t("common.cancel", { defaultValue: "Anuluj" })}
            </Button>
            <Button
              onClick={() => folderMut.mutate(folderName.trim())}
              disabled={!folderName.trim() || folderMut.isPending}
            >
              {t("common.create", { defaultValue: "Utwórz" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organizations.dysk.delete_confirm_title", {
                defaultValue: "Usunąć element?",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.kind === "folder"
                ? t("organizations.dysk.delete_confirm_folder", {
                    defaultValue:
                      "Spowoduje to usunięcie folderu „{{name}}” wraz z całą zawartością.",
                    name: toDelete?.name,
                  })
                : t("organizations.dysk.delete_confirm_file", {
                    defaultValue: "Plik „{{name}}” zostanie trwale usunięty.",
                    name: toDelete?.name,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Anuluj" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && delMut.mutate(toDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", { defaultValue: "Usuń" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
