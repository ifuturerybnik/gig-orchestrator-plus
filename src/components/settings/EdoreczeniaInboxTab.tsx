import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw, Inbox, Mail as MailIcon, X } from "lucide-react";
import { listAdeInbox, getAdeMessage, type AdeInboxResult, type AdeInboxRow } from "@/lib/ade-inbox.functions";
import { toast } from "sonner";

export default function EdoreczeniaInboxTab() {
  const load = useServerFn(listAdeInbox);
  const openMsg = useServerFn(getAdeMessage);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdeInboxResult | null>(null);
  const [selected, setSelected] = useState<AdeInboxRow | null>(null);
  const [detail, setDetail] = useState<{ loading: boolean; body: string; error?: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load({ data: { limit: 50 } });
      setResult(res);
      if (!res.ok) toast.error(res.error ?? "Nie udało się pobrać wiadomości");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openMessage(row: AdeInboxRow) {
    setSelected(row);
    setDetail({ loading: true, body: "" });
    try {
      const res = await openMsg({ data: { id: row.id } });
      setDetail({ loading: false, body: res.body, error: res.error });
    } catch (err) {
      setDetail({ loading: false, body: "", error: (err as Error).message });
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
            </CardDescription>
          </div>
          <Button onClick={refresh} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Odśwież
          </Button>
        </CardHeader>
        <CardContent>
          {result && !result.ok && (
            <Alert variant="destructive" className="mb-3">
              <AlertTitle>Błąd pobierania</AlertTitle>
              <AlertDescription className="font-mono text-xs break-all">{result.error}</AlertDescription>
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
                  <MailIcon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{row.subject || "(bez tematu)"}</span>
                      {row.status && <Badge variant="secondary" className="text-[10px]">{row.status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.from || "?"} → {row.to || "?"}
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
              Brak wiadomości w skrzynce.
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{selected.subject || "(bez tematu)"}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {selected.from} → {selected.to}
                {selected.receivedAt ? ` · ${new Date(selected.receivedAt).toLocaleString("pl-PL")}` : ""}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setSelected(null); setDetail(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {detail?.loading ? (
              <div className="flex items-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Pobieranie wiadomości…
              </div>
            ) : detail?.error ? (
              <Alert variant="destructive"><AlertDescription className="font-mono text-xs break-all">{detail.error}</AlertDescription></Alert>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted p-3 rounded max-h-[500px] overflow-auto">
                {formatJson(detail?.body ?? "")}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
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
