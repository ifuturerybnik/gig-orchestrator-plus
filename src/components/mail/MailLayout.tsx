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
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listSkrzynki, syncSkrzynka } from "@/lib/email-skrzynki.functions";
import {
  fetchWiadomoscBody,
  markWiadomosc,
  deleteWiadomoscRemote,
  markSpamWiadomosc,
  bulkActionWiadomosci,
} from "@/lib/email-wiadomosci.functions";
import { ComposeDialog } from "./ComposeDialog";
import { SzablonyManager } from "./SzablonyManager";

export type MailScope = { kind: "user" } | { kind: "org"; orgId: string };

interface Props {
  /** Zakres skrzynek: osobiste (kind:'user') lub organizacja (kind:'org'). */
  scope: MailScope;
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

type SkrzynkaSummary = {
  id: string;
  nazwa: string;
  email: string;
};

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

export function MailLayout({ scope }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listSkrzynkiFn = useServerFn(listSkrzynki);
  const syncFn = useServerFn(syncSkrzynka);
  const fetchBodyFn = useServerFn(fetchWiadomoscBody);
  const markFn = useServerFn(markWiadomosc);
  const deleteRemoteFn = useServerFn(deleteWiadomoscRemote);
  const markSpamFn = useServerFn(markSpamWiadomosc);
  const bulkFn = useServerFn(bulkActionWiadomosci);

  // Skrzynki organizacji (tylko gdy scope=org)
  const orgSkrzynkiQ = useQuery({
    queryKey: scope.kind === "org" ? ["org-skrzynki", scope.orgId] : ["org-skrzynki", "none"],
    enabled: scope.kind === "org",
    queryFn: () =>
      listSkrzynkiFn({
        data: { scope: "organization", organizationId: scope.kind === "org" ? scope.orgId : "" },
      }),
  });

  // Skrzynki osobiste — zawsze (w org module też pokazujemy "Moje skrzynki")
  const mySkrzynkiQ = useQuery({
    queryKey: ["user-skrzynki"],
    queryFn: () => listSkrzynkiFn({ data: { scope: "mine" } }),
  });

  const orgSkrzynki = (orgSkrzynkiQ.data?.skrzynki ?? []) as SkrzynkaSummary[];
  const mySkrzynki = (mySkrzynkiQ.data?.skrzynki ?? []) as SkrzynkaSummary[];
  const skrzynki: SkrzynkaSummary[] =
    scope.kind === "org" ? [...orgSkrzynki, ...mySkrzynki] : mySkrzynki;
  const skrzynkiLoading =
    scope.kind === "org" ? orgSkrzynkiQ.isLoading || mySkrzynkiQ.isLoading : mySkrzynkiQ.isLoading;

  const [skrzynkaId, setSkrzynkaId] = useState<string | null>(null);
  const [folder, setFolder] = useState("INBOX");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReply, setComposeReply] = useState<Wiadomosc | null>(null);
  const [view, setView] = useState<"mail" | "szablony">("mail");
  const [bodyLoadingId, setBodyLoadingId] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<{ id: string; message: string } | null>(null);
  // Mobilna nawigacja: pokazujemy jeden panel naraz (nav -> list -> message).
  // Na md+ wszystkie 3 panele są widoczne równolegle.
  const [mobilePane, setMobilePane] = useState<"nav" | "list" | "message">("nav");



  useEffect(() => {
    if (!skrzynkaId && skrzynki.length > 0) {
      setSkrzynkaId(skrzynki[0].id);
    }
  }, [skrzynki, skrzynkaId]);

  // Reset zaznaczenia przy zmianie skrzynki / folderu
  useEffect(() => {
    setSelectedIds(new Set());
  }, [skrzynkaId, folder]);

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

  async function handleSpam(w: Wiadomosc) {
    try {
      await markSpamFn({ data: { wiadomoscId: w.id } });
      if (selectedId === w.id) setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
      toast.success(t("correspondence.mail.marked_spam"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (prev.size === wiadomosci.length && wiadomosci.length > 0) return new Set();
      return new Set(wiadomosci.map((w) => w.id));
    });
  }

  async function handleBulk(action: "delete" | "spam" | "read" | "unread") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(t("correspondence.mail.bulk_delete_confirm", { count: ids.length }))) {
      return;
    }
    setBulkBusy(true);
    try {
      await bulkFn({ data: { ids, action } });
      setSelectedIds(new Set());
      if (action === "delete" || action === "spam") setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
      toast.success(t("correspondence.mail.bulk_done", { count: ids.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBulkBusy(false);
    }
  }

  if (skrzynkiLoading) {
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
        scope={scope}
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

      <div className="flex gap-0 h-[calc(100vh-180px)] min-h-[500px] md:-mx-4">
        {/* Sidebar: skrzynki + foldery */}
        <Card
          className={cn(
            "w-full md:w-56 shrink-0 p-2 overflow-y-auto",
            mobilePane === "nav" ? "block" : "hidden md:block",
          )}
        >
          {scope.kind === "org" && orgSkrzynki.length > 0 && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">
                {t("correspondence.mail.mailbox_section_org")}
              </div>
              {orgSkrzynki.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSkrzynkaId(s.id); setMobilePane("list"); }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent truncate",
                    skrzynkaId === s.id && "bg-accent font-medium",
                  )}
                  title={s.email}
                >
                  {s.nazwa}
                </button>
              ))}
            </>
          )}

          {scope.kind === "org" && mySkrzynki.length > 0 && (
            <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mt-4 mb-1">
              {t("correspondence.mail.mailbox_section_mine")}
            </div>
          )}
          {scope.kind !== "org" && skrzynki.length > 0 && (
            <div className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">
              {t("correspondence.mail.mailboxes")}
            </div>
          )}
          {(scope.kind === "org" ? mySkrzynki : skrzynki).map((s) => (
            <button
              key={s.id}
              onClick={() => { setSkrzynkaId(s.id); setMobilePane("list"); }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent truncate",
                skrzynkaId === s.id && "bg-accent font-medium",
              )}
              title={s.email}
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
                onClick={() => {
                  setFolder(f.id);
                  setMobilePane("list");
                }}
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
        <Card
          className={cn(
            "w-full md:w-80 shrink-0 overflow-hidden flex-col",
            mobilePane === "list" ? "flex" : "hidden md:flex",
          )}
        >
          <div className="md:hidden flex items-center gap-2 border-b border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobilePane("nav")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("correspondence.mail.folders.label")}
            </Button>
          </div>
          {/* Pasek akcji zbiorowych — zawsze widoczny */}
          <div className="flex items-center gap-2 border-b border-border p-2 flex-wrap">
            <Checkbox
              checked={
                wiadomosci.length > 0 && selectedIds.size === wiadomosci.length
                  ? true
                  : selectedIds.size > 0
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={() => toggleSelectAll()}
              aria-label={t("correspondence.mail.select_all")}
              disabled={wiadomosci.length === 0}
            />
            {selectedIds.size > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {t("correspondence.mail.bulk_selected_count", { count: selectedIds.size })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulk("read")}
                  title={t("correspondence.mail.bulk_mark_read")}
                >
                  <MailOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulk("unread")}
                  title={t("correspondence.mail.bulk_mark_unread")}
                >
                  <MailIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulk("spam")}
                  title={t("correspondence.mail.bulk_spam")}
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulk("delete")}
                  title={t("correspondence.mail.bulk_delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t("correspondence.mail.select_all")}</span>
            )}
          </div>
          <ScrollArea className="flex-1">
            {wiadQ.isLoading && (
              <div className="p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
            )}
            {wiadomosci.length === 0 && !wiadQ.isLoading && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {t("correspondence.mail.empty_folder")}
              </div>
            )}
            {wiadomosci.map((w) => {
              const checked = selectedIds.has(w.id);
              return (
                <div
                  key={w.id}
                  className={cn(
                    "flex items-start gap-2 px-2 py-2 border-b border-border hover:bg-accent/40 transition",
                    selectedId === w.id && "bg-accent",
                    checked && "bg-accent/60",
                  )}
                >
                  <Checkbox
                    className="mt-1"
                    checked={checked}
                    onCheckedChange={() => toggleSelected(w.id)}
                    aria-label="select"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(w.id);
                      setMobilePane("message");
                    }}
                    className={cn(
                      "flex-1 text-left min-w-0",
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
                </div>
              );
            })}
          </ScrollArea>
        </Card>

        {/* Podgląd */}
        <Card
          className={cn(
            "flex-1 overflow-hidden flex-col",
            mobilePane === "message" ? "flex" : "hidden md:flex",
          )}
        >
          <div className="md:hidden flex items-center gap-2 border-b border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobilePane("list")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("correspondence.mail.title")}
            </Button>
          </div>
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
          scope={scope}
          skrzynkaId={skrzynkaId}
          replyTo={composeReply}
        />
      )}
    </div>
  );
}
