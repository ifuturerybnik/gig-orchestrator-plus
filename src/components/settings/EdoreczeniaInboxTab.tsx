import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  RefreshCw,
  Inbox,
  Mail as MailIcon,
  X,
  Paperclip,
  Download,
  FileArchive,
  Send,
  FileEdit,
  Trash2,
  PenSquare,
} from "lucide-react";
import EdoreczeniaComposeDialog from "./EdoreczeniaComposeDialog";

import {
  syncAdeInbox,
  listStoredDeliveries,
  openStoredDelivery,
  downloadEvidenceZip,
  moveAdeDelivery,
  type AdeInboxResult,
  type AdeInboxRow,
  type AdeDeliveryDetail,
  type AdeFolder,
} from "@/lib/ade-inbox.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Reply, Forward } from "lucide-react";

const FOLDERS: { id: AdeFolder; label: string; icon: typeof Inbox }[] = [
  { id: "INBOX", label: "Odebrane", icon: Inbox },
  { id: "SENT", label: "Wysłane", icon: Send },
  { id: "DRAFTS", label: "Robocze", icon: FileEdit },
  { id: "TRASH", label: "Usunięte", icon: Trash2 },
];

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("pl-PL");
}

export default function EdoreczeniaInboxTab() {
  const sync = useServerFn(syncAdeInbox);
  const list = useServerFn(listStoredDeliveries);
  const open = useServerFn(openStoredDelivery);
  const fetchEvidence = useServerFn(downloadEvidenceZip);
  const [folder, setFolder] = useState<AdeFolder>("INBOX");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<AdeInboxResult | null>(null);
  const [selected, setSelected] = useState<AdeInboxRow | null>(null);
  const [detail, setDetail] = useState<{ loading: boolean; data?: AdeDeliveryDetail; error?: string } | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);


  const reload = useCallback(
    async (f: AdeFolder) => {
      setLoading(true);
      try {
        const res = await list({ data: { limit: 100, folder: f } });
        setResult(res);
        if (!res.ok) toast.error(res.error ?? "Nie udało się pobrać listy");
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [list],
  );

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const s = await sync({ data: { limit: 100, folder } });
      if (!s.ok) toast.error(s.error ?? "Sync nieudany");
      else toast.success(`Zsynchronizowano ${folder}: ${s.fetched} (nowe: ${s.inserted}, aktualizacje: ${s.updated})`);
      await reload(folder);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [sync, reload, folder]);

  useEffect(() => {
    void reload(folder);
    setSelected(null);
    setDetail(null);
  }, [reload, folder]);

  async function openMessage(row: AdeInboxRow) {
    setSelected(row);
    setDetail({ loading: true });
    try {
      const res = await open({ data: { id: row.id } });
      setDetail({ loading: false, data: res, error: res.ok ? undefined : res.error });
      if (res.ok) void reload(folder);
    } catch (err) {
      setDetail({ loading: false, error: (err as Error).message });
    }
  }

  async function handleDownloadEvidence() {
    if (!selected) return;
    setEvidenceLoading(true);
    try {
      const res = await fetchEvidence({ data: { id: selected.id } });
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Nie udało się pobrać dowodów");
        return;
      }
      window.open(res.url, "_blank", "noopener");
      // odśwież detail, żeby zapisany URL był dostępny
      await openMessage(selected);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEvidenceLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Skrzynka e-Doręczeń
            </CardTitle>
            <CardDescription>
              {result?.mailbox ? <span className="font-mono">{result.mailbox}</span> : "Wiadomości z systemu ADE."}
              {result?.lastSyncedAt && (
                <span className="ml-2 text-xs">
                  · ostatni sync: {new Date(result.lastSyncedAt).toLocaleString("pl-PL")}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setComposeOpen(true)} size="sm">
              <PenSquare className="mr-2 h-4 w-4" />
              Nowa wiadomość
            </Button>
            <Button onClick={refresh} disabled={syncing || loading} variant="outline" size="sm">
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Synchronizuj
            </Button>
          </div>

        </CardHeader>
        <CardContent>
          {/* Foldery */}
          <div className="mb-4 inline-flex rounded-md border border-border bg-card p-1">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = f.id === folder;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 text-sm rounded transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {f.label}
                </button>
              );
            })}
          </div>

          {result?.lastSyncError && (
            <Alert variant="destructive" className="mb-3">
              <AlertTitle>Ostatni sync z błędem</AlertTitle>
              <AlertDescription className="font-mono text-xs break-all">{result.lastSyncError}</AlertDescription>
            </Alert>
          )}
          {loading && !result ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ładowanie…
            </div>
          ) : result?.items.length ? (
            <div className="divide-y">
              {result.items.map((row) => (
                <button
                  key={row.id}
                  onClick={() => openMessage(row)}
                  className="w-full text-left py-3 px-2 hover:bg-accent/50 rounded flex items-start gap-3"
                >
                  <MailIcon
                    className={`h-4 w-4 mt-1 shrink-0 ${row.readAt ? "text-muted-foreground" : "text-primary"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`truncate ${row.readAt ? "" : "font-semibold"}`}>
                        {row.subject || "(bez tematu)"}
                      </span>
                      {row.status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {row.status}
                        </Badge>
                      )}
                      {row.attachmentCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Paperclip className="h-3 w-3" />
                          {row.attachmentCount}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">{row.fromName ?? row.from ?? "?"}</span>
                      <span className="font-mono ml-1">{row.from ? `· ${row.from}` : ""}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {row.receivedAt ? new Date(row.receivedAt).toLocaleString("pl-PL") : ""}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Brak wiadomości w tym folderze. Kliknij <b>Synchronizuj</b>, aby pobrać z ADE.
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-lg">
                {detail?.data?.subject || selected.subject || "(bez tematu)"}
              </CardTitle>
              <CardDescription className="text-xs mt-1 space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Nadawca: </span>
                  <span className="font-medium">{detail?.data?.fromName ?? "—"}</span>{" "}
                  <span className="font-mono text-muted-foreground">
                    {detail?.data?.from ?? selected.from ?? ""}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Odbiorca: </span>
                  <span className="font-medium">{detail?.data?.toName ?? "—"}</span>{" "}
                  <span className="font-mono text-muted-foreground">
                    {detail?.data?.to ?? selected.to ?? ""}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data utworzenia: </span>
                  {fmtDate(detail?.data?.creationDate ?? selected.creationDate)}
                </div>
                <div>
                  <span className="text-muted-foreground">Data wysłania: </span>
                  {fmtDate(detail?.data?.sentAt ?? selected.sentAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">Data otrzymania: </span>
                  {fmtDate(detail?.data?.receivedAt ?? selected.receivedAt)}
                </div>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail?.loading ? (
              <div className="flex items-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Pobieranie treści z ADE…
              </div>
            ) : detail?.error ? (
              <Alert variant="destructive">
                <AlertDescription className="font-mono text-xs break-all">{detail.error}</AlertDescription>
              </Alert>
            ) : detail?.data ? (
              <>
                {detail.data.bodyText && (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed rounded border bg-card p-4">
                    {detail.data.bodyText}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleDownloadEvidence}
                    disabled={evidenceLoading}
                    variant="outline"
                    size="sm"
                  >
                    {evidenceLoading ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileArchive className="mr-2 h-3.5 w-3.5" />
                    )}
                    Pobierz dowody techniczne (ZIP)
                  </Button>
                </div>


                {detail.data.attachments.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Załączniki</div>
                    <div className="flex flex-wrap gap-2">
                      {detail.data.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs hover:bg-accent"
                        >
                          <Download className="h-3 w-3" />
                          <span className="truncate max-w-[220px]">{a.filename}</span>
                          {a.sizeBytes ? (
                            <span className="text-muted-foreground">{Math.round(a.sizeBytes / 1024)} kB</span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {detail.data.evidences.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-2 text-muted-foreground">Dowody techniczne</div>
                    <ul className="space-y-1.5">
                      {detail.data.evidences.map((e, idx) => (
                        <li key={idx} className="text-xs flex items-start gap-2">
                          {e.type && (
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                              {e.type}
                            </Badge>
                          )}
                          <div className="flex-1 min-w-0">
                            {e.reason && <div>{e.reason}</div>}
                            {e.eventDate && (
                              <div className="text-muted-foreground">
                                {new Date(e.eventDate).toLocaleString("pl-PL")}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.data.rawJson && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                      Pokaż surowe dane (JSON)
                    </summary>
                    <pre className="mt-2 font-mono whitespace-pre-wrap break-words bg-muted p-3 rounded max-h-[400px] overflow-auto">
                      {formatJson(detail.data.rawJson)}
                    </pre>
                  </details>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      <EdoreczeniaComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        fromAddress={result?.mailbox}
        onSent={() => {
          setFolder("SENT");
          void refresh();
        }}
      />
    </div>
  );
}


function formatJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
