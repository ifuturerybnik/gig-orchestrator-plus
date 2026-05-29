import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Plus, Eye, EyeOff, Users, Globe, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PerformanceDialog,
  type PerformanceInitial,
} from "@/components/performances/PerformanceDialog";
import { ContactDetailsDialog } from "@/components/contacts/ContactDetailsDialog";
import { CounterpartyDetailsDialog } from "@/components/organizations/CounterpartyDetailsDialog";
import {
  listPerformances,
  deletePerformance,
  findCounterpartyLinkForOrg,
  PERFORMANCE_EVENT_KIND_PRESETS,
  type PerformanceStatus,
  type PerformanceVisibility,
} from "@/lib/performances.functions";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/events",
)({
  component: OrganizationPerformancesPage,
});

const statusVariant: Record<PerformanceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  inquiry: "outline",
  tentative: "destructive",
  confirmed: "default",
  confirmed_signing: "default",
  confirmed_signed: "default",
};

const statusClassName: Record<PerformanceStatus, string> = {
  inquiry: "",
  tentative: "",
  confirmed: "bg-green-600 hover:bg-green-600/90 text-white border-transparent",
  confirmed_signing: "bg-yellow-500 hover:bg-yellow-500/90 text-black border-transparent",
  confirmed_signed: "bg-green-600 hover:bg-green-600/90 text-white border-transparent",
};

function VisibilityIcon({ v }: { v: PerformanceVisibility }) {
  if (v === "private") return <EyeOff className="h-4 w-4" />;
  if (v === "members_date" || v === "members_full") return <Users className="h-4 w-4" />;
  if (v === "public_date" || v === "public_full") return <Globe className="h-4 w-4" />;
  return <Eye className="h-4 w-4" />;
}

function OrganizationPerformancesPage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceInitial | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailsContactId, setDetailsContactId] = useState<string | null>(null);
  const [detailsCpLinkId, setDetailsCpLinkId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Calendar popover state — anchor positioned at click coords
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);

  const qc = useQueryClient();
  const fetchList = useServerFn(listPerformances);
  const findCpLink = useServerFn(findCounterpartyLinkForOrg);
  const removePerformance = useServerFn(deletePerformance);
  const { data, isLoading } = useQuery({
    queryKey: ["performances", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });

  const renderEventKind = (kind: string) => {
    if ((PERFORMANCE_EVENT_KIND_PRESETS as readonly string[]).includes(kind)) {
      return t(`organizations.performances.event_kind.${kind}`);
    }
    return kind;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await removePerformance({ data: { organizationId: orgId, performanceId: deleteId } });
      toast.success(t("organizations.performances.toasts.deleted"));
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: ["performances", orgId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const items = data?.items ?? [];

  // Build a map: yyyy-MM-dd -> events for that day
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const p of items) {
      const arr = map.get(p.performance_date) ?? [];
      arr.push(p);
      map.set(p.performance_date, arr);
    }
    return map;
  }, [items]);

  const eventDates = useMemo(
    () =>
      Array.from(eventsByDate.keys()).map((iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
      }),
    [eventsByDate],
  );

  const popoverItems = popoverDate ? eventsByDate.get(popoverDate) ?? [] : [];

  const openCreate = (iso?: string) => {
    setEditing(null);
    setCreateDate(iso ?? null);
    setOpen(true);
  };

  const openEdit = (p: (typeof items)[number]) => {
    setEditing({
      id: p.id,
      performance_date: p.performance_date,
      status: p.status as PerformanceStatus,
      visibility: p.visibility as PerformanceVisibility,
      event_kind: p.event_kind,
      name: p.name,
      city: p.city,
      postal_code: p.postal_code,
      street: p.street,
      street_number: p.street_number,
      google_maps_url: p.google_maps_url,
      notes: p.notes,
      assignments: p.assignments,
    });
    setCreateDate(null);
    setOpen(true);
  };

  const handleDayClick = (day: Date, _mods: unknown, e: React.MouseEvent) => {
    const iso = format(day, "yyyy-MM-dd");
    const dayEvents = eventsByDate.get(iso) ?? [];
    if (dayEvents.length === 0) {
      openCreate(iso);
      return;
    }
    setPopoverDate(iso);
    setPopoverAnchor({ x: e.clientX, y: e.clientY });
  };

  const openCpDetails = async (cpOrgId: string) => {
    try {
      const res = await findCpLink({
        data: { ownerOrgId: orgId, counterpartyOrgId: cpOrgId },
      });
      if (res.linkId) setDetailsCpLinkId(res.linkId);
      else toast.error(t("organizations.performances.errors.cp_link_missing"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("organizations.performances.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("organizations.performances.subtitle")}
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          {t("organizations.performances.add")}
        </Button>
      </div>

      {/* Calendar overview — click empty day = create, click busy day = popover */}
      <div className="rounded-md border border-border bg-card p-3">
        <Calendar
          mode="single"
          onDayClick={handleDayClick}
          modifiers={{ hasEvents: eventDates }}
          modifiersClassNames={{
            hasEvents:
              "relative font-semibold !bg-primary/15 !text-primary hover:!bg-primary/25",
          }}
          showOutsideDays
          className="pointer-events-auto mx-auto"
          classNames={{
            months: "flex flex-col sm:flex-row gap-4 w-full",
            month: "flex-1 space-y-4",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-xs",
            row: "flex w-full mt-2",
            cell: "flex-1 text-center text-sm relative",
            day: "h-10 w-full p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent transition-colors",
          }}
        />
      </div>

      <Popover
        open={!!popoverDate}
        onOpenChange={(o) => {
          if (!o) {
            setPopoverDate(null);
            setPopoverAnchor(null);
          }
        }}
      >
        <PopoverAnchor asChild>
          <div
            style={{
              position: "fixed",
              left: popoverAnchor?.x ?? 0,
              top: popoverAnchor?.y ?? 0,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
        </PopoverAnchor>
        <PopoverContent side="top" align="center" className="w-80 p-3">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {popoverDate}
            </p>
            <div className="space-y-1.5">
              {popoverItems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPopoverDate(null);
                    setPopoverAnchor(null);
                    openEdit(p);
                  }}
                  className="flex w-full items-start gap-2 rounded-md border border-border bg-background p-2 text-left text-xs transition-colors hover:bg-accent"
                >
                  <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">
                        {p.name?.trim() || renderEventKind(p.event_kind)}
                      </span>
                      <Badge
                        variant={statusVariant[p.status as PerformanceStatus]}
                        className={`${statusClassName[p.status as PerformanceStatus]} shrink-0`}
                      >
                        {t(`organizations.performances.status.${p.status}`)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {renderEventKind(p.event_kind)}
                      {p.city ? ` · ${p.city}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const iso = popoverDate;
                setPopoverDate(null);
                setPopoverAnchor(null);
                if (iso) openCreate(iso);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("organizations.performances.add")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>



      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t("organizations.performances.empty_title")}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("organizations.performances.empty")}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("organizations.performances.col.date")}</TableHead>
                <TableHead>{t("organizations.performances.col.event_kind")}</TableHead>
                <TableHead>{t("organizations.performances.col.status")}</TableHead>
                <TableHead>{t("organizations.performances.col.name")}</TableHead>
                <TableHead>{t("organizations.performances.col.city")}</TableHead>
                <TableHead>{t("organizations.performances.col.assignments")}</TableHead>
                <TableHead className="w-12">{t("organizations.performances.col.visibility")}</TableHead>
                <TableHead className="w-12 text-right">{t("organizations.performances.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <HoverCard key={p.id} openDelay={250} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <TableRow
                      onClick={() => openEdit(p)}
                      className="cursor-pointer"
                      title={t("organizations.performances.actions.click_to_edit")}
                    >
                      <TableCell className="font-medium">{p.performance_date}</TableCell>
                      <TableCell>{renderEventKind(p.event_kind)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant[p.status as PerformanceStatus]}
                          className={statusClassName[p.status as PerformanceStatus]}
                        >
                          {t(`organizations.performances.status.${p.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.name ?? "—"}</TableCell>
                      <TableCell>{p.city ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.assignments.contacts.map((c) => (
                            <Badge
                              key={`c-${c.id}`}
                              variant="outline"
                              className="text-xs cursor-pointer hover:bg-accent"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsContactId(c.id);
                              }}
                            >
                              {c.name}
                            </Badge>
                          ))}
                          {p.assignments.counterparties.map((o) => (
                            <Badge
                              key={`o-${o.id}`}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-secondary/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCpDetails(o.id);
                              }}
                            >
                              {o.name}
                            </Badge>
                          ))}
                          {p.assignments.contacts.length === 0 &&
                            p.assignments.counterparties.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          title={t(`organizations.performances.visibility.${p.visibility}`)}
                          className="text-muted-foreground"
                        >
                          <VisibilityIcon v={p.visibility as PerformanceVisibility} />
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("organizations.performances.actions.delete")}
                          title={t("organizations.performances.actions.delete")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(p.id);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" align="start" className="w-96">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {p.name?.trim() ||
                            t(`organizations.performances.status.${p.status}`)}
                        </p>
                        <Badge
                          variant={statusVariant[p.status as PerformanceStatus]}
                          className={statusClassName[p.status as PerformanceStatus]}
                        >
                          {t(`organizations.performances.status.${p.status}`)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                        <span>{t("organizations.performances.col.date")}:</span>
                        <span className="text-foreground">{p.performance_date}</span>
                        <span>{t("organizations.performances.fields.event_kind")}:</span>
                        <span className="text-foreground">{p.event_kind}</span>
                        <span>{t("organizations.performances.fields.visibility")}:</span>
                        <span className="text-foreground">
                          {t(`organizations.performances.visibility.${p.visibility}`)}
                        </span>
                        {(p.city || p.street || p.postal_code) && (
                          <>
                            <span>{t("organizations.performances.col.city")}:</span>
                            <span className="text-foreground">
                              {[
                                [p.street, p.street_number].filter(Boolean).join(" "),
                                [p.postal_code, p.city].filter(Boolean).join(" "),
                              ]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </span>
                          </>
                        )}
                      </div>
                      {(p.assignments.contacts.length > 0 ||
                        p.assignments.counterparties.length > 0) && (
                        <div className="border-t border-border pt-2">
                          <p className="mb-1 font-medium text-foreground">
                            {t("organizations.performances.assignments.title")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {p.assignments.contacts.map((c) => (
                              <Badge key={`hc-${c.id}`} variant="outline" className="text-[10px]">
                                {c.name}
                              </Badge>
                            ))}
                            {p.assignments.counterparties.map((o) => (
                              <Badge key={`ho-${o.id}`} variant="secondary" className="text-[10px]">
                                {o.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {p.notes && (
                        <div className="border-t border-border pt-2">
                          <p className="mb-1 font-medium text-foreground">
                            {t("organizations.performances.fields.notes")}
                          </p>
                          <p className="whitespace-pre-wrap text-muted-foreground line-clamp-6">
                            {p.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PerformanceDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditing(null);
            setCreateDate(null);
          }
        }}
        organizationId={orgId}
        initial={editing}
        initialDate={createDate}
      />

      <ContactDetailsDialog
        contactId={detailsContactId}
        scope={{ kind: "org", organizationId: orgId }}
        onOpenChange={(o) => !o && setDetailsContactId(null)}
      />
      <CounterpartyDetailsDialog
        linkId={detailsCpLinkId}
        onOpenChange={(o) => !o && setDetailsCpLinkId(null)}
        ownerOrgId={orgId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && !deleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organizations.performances.actions.delete_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.performances.actions.delete_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("organizations.performances.actions.delete_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("organizations.performances.actions.delete_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
