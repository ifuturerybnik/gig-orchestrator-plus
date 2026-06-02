import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Eye,
  EyeOff,
  Users,
  Globe,
  Trash2,
  Pencil,
  Plane,
} from "lucide-react";
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
import {
  VacationDialog,
  type VacationInitial,
} from "@/components/vacations/VacationDialog";
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
import { listVacations } from "@/lib/vacations.functions";
import { getMyOrgPermissions } from "@/lib/organizations.functions";

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

function isoFromDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function eachDayIso(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    out.push(format(d, "yyyy-MM-dd"));
  }
  return out;
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

  // Vacation dialog state
  const [vacOpen, setVacOpen] = useState(false);
  const [vacEditing, setVacEditing] = useState<VacationInitial | null>(null);
  const [vacInitialDate, setVacInitialDate] = useState<string | null>(null);

  // Hover popover state — anchor positioned at cell coords
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setPopoverDate(null);
      setPopoverAnchor(null);
    }, 200);
  };

  const qc = useQueryClient();
  const fetchList = useServerFn(listPerformances);
  const fetchVacations = useServerFn(listVacations);
  const findCpLink = useServerFn(findCounterpartyLinkForOrg);
  const removePerformance = useServerFn(deletePerformance);
  const fetchPerms = useServerFn(getMyOrgPermissions);
  const permsQuery = useQuery({
    queryKey: ["org-my-permissions", orgId],
    queryFn: () => fetchPerms({ data: { organizationId: orgId } }),
  });
  const myPerms = permsQuery.data?.permissions ?? null;
  const canEditEvents =
    !myPerms || myPerms.isOrgAdmin || myPerms.eventsMode === "full";
  const { data, isLoading } = useQuery({
    queryKey: ["performances", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });
  const { data: vacData } = useQuery({
    queryKey: ["vacations", orgId],
    queryFn: () => fetchVacations({ data: { organizationId: orgId } }),
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
  const vacations = vacData?.items ?? [];

  // Build maps for performance lookup by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const p of items) {
      const arr = map.get(p.performance_date) ?? [];
      arr.push(p);
      map.set(p.performance_date, arr);
    }
    return map;
  }, [items]);

  // Build vacation day-coverage maps and modifier date arrays
  const vacByDate = useMemo(() => {
    const map = new Map<string, typeof vacations>();
    for (const v of vacations) {
      for (const iso of eachDayIso(v.start_date, v.end_date)) {
        const arr = map.get(iso) ?? [];
        arr.push(v);
        map.set(iso, arr);
      }
    }
    return map;
  }, [vacations]);

  const { vacStart, vacEnd, vacMid, vacSingle } = useMemo(() => {
    const vS: Date[] = [];
    const vE: Date[] = [];
    const vM: Date[] = [];
    const vSi: Date[] = [];
    for (const v of vacations) {
      const days = eachDayIso(v.start_date, v.end_date);
      if (days.length === 1) {
        vSi.push(parseIso(days[0]));
        continue;
      }
      days.forEach((iso, i) => {
        const d = parseIso(iso);
        if (i === 0) vS.push(d);
        else if (i === days.length - 1) vE.push(d);
        else vM.push(d);
      });
    }
    return { vacStart: vS, vacEnd: vE, vacMid: vM, vacSingle: vSi };
  }, [vacations]);

  const eventDates = useMemo(
    () =>
      Array.from(eventsByDate.keys()).map((iso) => parseIso(iso)),
    [eventsByDate],
  );

  const popoverEvents = popoverDate ? eventsByDate.get(popoverDate) ?? [] : [];
  const popoverVacations = popoverDate ? vacByDate.get(popoverDate) ?? [] : [];

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

  const openVacCreate = (iso?: string) => {
    setVacEditing(null);
    setVacInitialDate(iso ?? null);
    setVacOpen(true);
  };
  const openVacEdit = (v: (typeof vacations)[number]) => {
    setVacEditing({
      id: v.id,
      start_date: v.start_date,
      end_date: v.end_date,
      description: v.description,
    });
    setVacInitialDate(null);
    setVacOpen(true);
  };

  const showPopover = (day: Date, e: { clientX: number; clientY: number }) => {
    const iso = isoFromDate(day);
    const hasEvents = (eventsByDate.get(iso)?.length ?? 0) > 0;
    const hasVac = (vacByDate.get(iso)?.length ?? 0) > 0;
    if (!hasEvents && !hasVac) return;
    cancelClose();
    setPopoverDate(iso);
    setPopoverAnchor({ x: e.clientX, y: e.clientY });
  };

  const handleDayClick = (day: Date) => {
    const iso = isoFromDate(day);
    const dayEvents = eventsByDate.get(iso) ?? [];
    if (dayEvents.length === 0 && (vacByDate.get(iso)?.length ?? 0) === 0) {
      if (canEditEvents) openCreate(iso);
    }
    // If date is busy, hover already shows popover — click is a no-op
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
        <div className="flex gap-2">
          {canEditEvents && (
            <>
              <Button variant="outline" onClick={() => openVacCreate()}>
                <Plane className="h-4 w-4" />
                {t("organizations.vacations.add")}
              </Button>
              <Button onClick={() => openCreate()}>
                <Plus className="h-4 w-4" />
                {t("organizations.performances.add")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Calendar overview — hover to show day details popover */}
      <div className="rounded-md border border-border bg-card p-3">
        <Calendar
          mode="single"
          onDayClick={handleDayClick}
          onDayMouseEnter={(day, _mods, e) =>
            showPopover(day, { clientX: e.clientX, clientY: e.clientY })
          }
          onDayMouseLeave={() => scheduleClose()}
          modifiers={{
            hasEvents: eventDates,
            vacStart,
            vacEnd,
            vacMid,
            vacSingle,
          }}
          modifiersClassNames={{
            hasEvents:
              "font-semibold !bg-primary/15 !text-primary hover:!bg-primary/25",
            vacStart:
              "after:content-[''] after:absolute after:left-1 after:right-0 after:bottom-1 after:h-1 after:bg-amber-500 after:rounded-l-full",
            vacEnd:
              "after:content-[''] after:absolute after:left-0 after:right-1 after:bottom-1 after:h-1 after:bg-amber-500 after:rounded-r-full",
            vacMid:
              "after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-1 after:h-1 after:bg-amber-500",
            vacSingle:
              "after:content-[''] after:absolute after:left-1 after:right-1 after:bottom-1 after:h-1 after:bg-amber-500 after:rounded-full",
          }}
          showOutsideDays
          className="pointer-events-auto w-full [--cell-size:3rem]"
          classNames={{
            root: "w-full",
            months: "relative flex w-full flex-col gap-4",
            month: "relative flex w-full flex-col gap-4",
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
        <PopoverContent
          side="top"
          align="center"
          className="w-80 p-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{popoverDate}</p>

            {popoverVacations.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("organizations.vacations.title")}
                </p>
                {popoverVacations.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setPopoverDate(null);
                      setPopoverAnchor(null);
                      if (canEditEvents) openVacEdit(v);
                    }}
                    className="flex w-full items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-left text-xs transition-colors hover:bg-amber-500/20"
                  >
                    <Plane className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-medium text-foreground">
                        {v.start_date}
                        {v.end_date !== v.start_date ? ` → ${v.end_date}` : ""}
                      </p>
                      {v.description && (
                        <p className="line-clamp-2 text-muted-foreground">
                          {v.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {popoverEvents.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("organizations.performances.title")}
                </p>
                {popoverEvents.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPopoverDate(null);
                      setPopoverAnchor(null);
                      if (canEditEvents) openEdit(p);
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
            )}

            {canEditEvents && (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
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
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const iso = popoverDate;
                    setPopoverDate(null);
                    setPopoverAnchor(null);
                    if (iso) openVacCreate(iso);
                  }}
                >
                  <Plane className="h-3.5 w-3.5" />
                  {t("organizations.vacations.add")}
                </Button>
              </div>
            )}
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
                      onClick={canEditEvents ? () => openEdit(p) : undefined}
                      className={canEditEvents ? "cursor-pointer" : ""}
                      title={canEditEvents ? t("organizations.performances.actions.click_to_edit") : undefined}
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
                        {canEditEvents && (
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
                        )}
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

      <VacationDialog
        open={vacOpen}
        onOpenChange={(v) => {
          setVacOpen(v);
          if (!v) {
            setVacEditing(null);
            setVacInitialDate(null);
          }
        }}
        organizationId={orgId}
        initial={vacEditing}
        initialDate={vacInitialDate}
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
