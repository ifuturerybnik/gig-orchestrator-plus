// Concertivo — główny UI Poczty dla organizacji.
// Lewy panel: lista skrzynek + folderów. Środek: lista wiadomości. Prawy: podgląd.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import DOMPurify from "isomorphic-dompurify";
import {
  Inbox,
  Send,
  FileEdit,
  ShieldAlert,
  RefreshCw,
  Mail as MailIcon,
  MailOpen,
  Star,
  Trash2,
  PenSquare,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listSkrzynki, syncSkrzynka } from "@/lib/email-skrzynki.functions";
import {
  fetchWiadomoscBody,
  markWiadomosc,
  deleteWiadomoscRemote,
} from "@/lib/email-wiadomosci.functions";
import { ComposeDialog } from "./ComposeDialog";
import { SzablonyManager } from "./SzablonyManager";

interface Props {
  orgId: string;
}

interface Wiadomosc {
  id: string;
  skrzynka_id: string;
  folder: string;
  od_email: string | null;
  od_nazwa: string | null;
  do_emails: Array<{ email: string; name?: string }>;
  temat: string;
  data_otrzymania: string | null;
  data_wyslania: string | null;
  przeczytana: boolean;
  oznaczona_gwiazdka: boolean;
  ma_zalaczniki: boolean;
  body_html: string | null;
  body_text: string | null;
}

const FOLDERS = [
  { id: "INBOX", labelKey: "correspondence.mail.folders.inbox", icon: Inbox },
  { id: "Sent", labelKey: "correspondence.mail.folders.sent", icon: Send },
  { id: "Drafts", labelKey: "correspondence.mail.folders.drafts", icon: FileEdit },
  { id: "Spam", labelKey: "correspondence.mail.folders.spam", icon: ShieldAlert },
];

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return (
    dt.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    dt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })
  );
}

export function MailLayout({ orgId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listSkrzynkiFn = useServerFn(listSkrzynki);
  const syncFn = useServerFn(syncSkrzynka);
  const fetchBodyFn = useServerFn(fetchWiadomoscBody);
  const markFn = useServerFn(markWiadomosc);
  const deleteRemoteFn = useServerFn(deleteWiadomoscRemote);

  const skrzynkiQ = useQuery({
    queryKey: ["org-skrzynki", orgId],
    queryFn: () => listSkrzynkiFn({ data: { scope: "organization", organizationId: orgId } }),
  });
  const skrzynki = skrzynkiQ.data?.skrzynki ?? [];

  const [skrzynkaId, setSkrzynkaId] = useState<string | null>(null);
  const [folder, setFolder] = useState("INBOX");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReply, setComposeReply] = useState<Wiadomosc | null>(null);
  const [view, setView] = useState<"mail" | "szablony">("mail");
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (!skrzynkaId && skrzynki.length > 0) {
      setSkrzynkaId(skrzynki[0].id);
    }
  }, [skrzynki, skrzynkaId]);

  const wiadQ = useQuery({
    queryKey: ["email_wiadomosci", skrzynkaId, folder],
    enabled: !!skrzynkaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_wiadomosci")
        .select(
          "id, skrzynka_id, folder, od_email, od_nazwa, do_emails, temat, data_otrzymania, data_wyslania, przeczytana, oznaczona_gwiazdka, ma_zalaczniki, body_html, body_text",
        )
        .eq("skrzynka_id", skrzynkaId!)
        .eq("folder", folder)
        .order("data_otrzymania", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Wiadomosc[];
    },
  });

  const wiadomosci = wiadQ.data ?? [];
  const selected = useMemo(
    () => wiadomosci.find((w) => w.id === selectedId) ?? null,
    [wiadomosci, selectedId],
  );

  // Realtime
  useEffect(() => {
    if (!skrzynkaId) return;
    const ch = supabase
      .channel(`mail-${skrzynkaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_wiadomosci",
          filter: `skrzynka_id=eq.${skrzynkaId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [skrzynkaId, qc]);

  // Auto pobranie body przy zaznaczeniu
  useEffect(() => {
    if (!selected) return;
    if (selected.body_html || selected.body_text) {
      setBodyLoadingId(null);
      setBodyError(null);
      return;
    }

    let cancelled = false;
    setBodyLoadingId(selected.id);
    setBodyError(null);
    fetchBodyFn({ data: { wiadomoscId: selected.id } })
      .then(async (result) => {
        if (cancelled) return;
        if (result.body_html || result.body_text) {
          qc.setQueryData<Wiadomosc[]>(["email_wiadomosci", skrzynkaId, folder], (current) =>
            (current ?? []).map((w) =>
              w.id === selected.id
                ? { ...w, body_html: result.body_html, body_text: result.body_text }
                : w,
            ),
          );
        } else {
          setBodyError({ id: selected.id, message: t("common.error") });
        }
        await qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId, folder] });
      })
      .catch((error) => {
        if (!cancelled) {
          setBodyError({
            id: selected.id,
            message: error instanceof Error ? error.message : t("common.error"),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setBodyLoadingId((current) => (current === selected.id ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [selected, fetchBodyFn, qc, skrzynkaId, folder, t]);

  async function handleSync() {
    if (!skrzynkaId) return;
    setSyncing(true);
    try {
      await syncFn({ data: { skrzynkaId, folder } });
      await qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
      toast.success(t("correspondence.mail.synced"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleMark(w: Wiadomosc, action: "read" | "unread" | "star" | "unstar") {
    try {
      await markFn({ data: { wiadomoscId: w.id, action } });
      qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function handleDelete(w: Wiadomosc) {
    if (!confirm(t("correspondence.mail.delete_confirm"))) return;
    try {
      await deleteRemoteFn({ data: { wiadomoscId: w.id } });
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
      toast.success(t("correspondence.mail.deleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  if (skrzynkiQ.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (skrzynki.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {t("correspondence.mail.no_mailboxes")}
      </div>
    );
  }

  if (view === "szablony") {
    return (
      <SzablonyManager
        orgId={orgId}
        onBack={() => setView("mail")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold flex-1">{t("correspondence.mail.title")}</h1>
        <Button variant="outline" size="sm" onClick={() => setView("szablony")}>
          <FileText className="h-4 w-4 mr-2" />
          {t("correspondence.mail.templates")}
        </Button>
        <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
          <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {t("correspondence.mail.sync")}
        </Button>
        <Button size="sm" onClick={() => { setComposeReply(null); setComposeOpen(true); }}>
          <PenSquare className="h-4 w-4 mr-2" />
          {t("correspondence.mail.compose")}
        </Button>
      </div>

      <div className="flex gap-0 h-[calc(100vh-180px)] min-h-[500px] -mx-4">
        {/* Sidebar: skrzynki + foldery */}
        <Card className="w-48 shrink-0 p-2 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">
            {t("correspondence.mail.mailboxes")}
          </div>
          {skrzynki.map((s) => (
            <button
              key={s.id}
              onClick={() => setSkrzynkaId(s.id)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent truncate",
                skrzynkaId === s.id && "bg-accent font-medium",
              )}
            >
              {s.nazwa}
            </button>
          ))}
          <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mt-4 mb-1">
            {t("correspondence.mail.folders.label")}
          </div>
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={cn(
                  "w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-sm hover:bg-accent",
                  folder === f.id && "bg-accent font-medium",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(f.labelKey)}
              </button>
            );
          })}
        </Card>

        {/* Lista wiadomości */}
        <Card className="w-80 shrink-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {wiadQ.isLoading && (
              <div className="p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
            )}
            {wiadomosci.length === 0 && !wiadQ.isLoading && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {t("correspondence.mail.empty_folder")}
              </div>
            )}
            {wiadomosci.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b border-border hover:bg-accent/40 transition",
                  selectedId === w.id && "bg-accent",
                  !w.przeczytana && "font-semibold",
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate flex-1">
                    {w.od_nazwa || w.od_email || "—"}
                  </span>
                  {w.oznaczona_gwiazdka && <Star className="h-3 w-3 fill-current text-amber-500" />}
                </div>
                <div className="text-sm truncate">{w.temat || "(brak tematu)"}</div>
                <div className="text-xs text-muted-foreground">{fmt(w.data_otrzymania)}</div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Podgląd */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              {t("correspondence.mail.select_message")}
            </div>
          )}
          {selected && (
            <>
              <div className="border-b border-border p-3 space-y-1">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{selected.temat || "(brak tematu)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {selected.od_nazwa || selected.od_email}
                      {selected.od_nazwa && selected.od_email ? ` <${selected.od_email}>` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmt(selected.data_otrzymania)}</div>
                  </div>
                  <Badge variant="outline" className="shrink-0">{folder}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMark(selected, selected.przeczytana ? "unread" : "read")}
                  >
                    {selected.przeczytana ? <MailIcon className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMark(selected, selected.oznaczona_gwiazdka ? "unstar" : "star")}
                  >
                    <Star className={cn("h-4 w-4", selected.oznaczona_gwiazdka && "fill-current text-amber-500")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setComposeReply(selected); setComposeOpen(true); }}
                  >
                    {t("correspondence.mail.reply")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(selected)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {selected.body_html ? (
                  <div
                    className="prose prose-sm max-w-none p-4 dark:prose-invert"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.body_html) }}
                  />
                ) : selected.body_text ? (
                  <pre className="whitespace-pre-wrap p-4 text-sm">{selected.body_text}</pre>
                ) : bodyError?.id === selected.id ? (
                  <div className="p-4 text-sm text-destructive">
                    {bodyError.message}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("correspondence.mail.loading_body")}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </Card>
      </div>

      {skrzynkaId && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          orgId={orgId}
          skrzynkaId={skrzynkaId}
          replyTo={composeReply}
        />
      )}
    </div>
  );
}
