import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { CalendarIcon, X, UserPlus, Building2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { ContactPicker } from "@/components/pickers/ContactPicker";
import { CounterpartyPicker } from "@/components/pickers/CounterpartyPicker";
import { AddCounterpartyDialog } from "@/components/organizations/AddCounterpartyDialog";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactDetailsDialog } from "@/components/contacts/ContactDetailsDialog";
import { CounterpartyDetailsDialog } from "@/components/organizations/CounterpartyDetailsDialog";

import { Textarea } from "@/components/ui/textarea";
import {
  createPerformance,
  updatePerformance,
  findCounterpartyLinkForOrg,
  listPerformances,
  listPerformanceEventKinds,
  PERFORMANCE_STATUSES,
  PERFORMANCE_VISIBILITIES,
  PERFORMANCE_EVENT_KIND_PRESETS,
  type PerformanceStatus,
  type PerformanceVisibility,
} from "@/lib/performances.functions";
import {
  listLinkedCounterpartiesForContact,
  listLinkedContactsForCounterparty,
} from "@/lib/contact-counterparty-links.functions";

export interface PerformanceInitial {
  id: string;
  performance_date: string;
  status: PerformanceStatus;
  visibility: PerformanceVisibility;
  event_kind: string;
  name: string | null;
  city: string | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  google_maps_url: string | null;
  notes: string | null;
  assignments: {
    contacts: { id: string; name: string }[];
    counterparties: { id: string; name: string }[];
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  initial?: PerformanceInitial | null;
}

type ContactRef = { id: string; name: string };
type CounterpartyRef = { id: string; name: string };

const CONFIRMED: PerformanceStatus[] = ["confirmed", "confirmed_signing", "confirmed_signed"];

export function PerformanceDialog({ open, onOpenChange, organizationId, initial }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const create = useServerFn(createPerformance);
  const update = useServerFn(updatePerformance);
  const findCpLink = useServerFn(findCounterpartyLinkForOrg);
  const fetchList = useServerFn(listPerformances);
  const fetchKinds = useServerFn(listPerformanceEventKinds);
  const fetchLinkedCps = useServerFn(listLinkedCounterpartiesForContact);
  const fetchLinkedContacts = useServerFn(listLinkedContactsForCounterparty);

  const isEdit = !!initial;

  const { data: kindsList } = useQuery({
    queryKey: ["performance-event-kinds", organizationId],
    queryFn: () => fetchKinds({ data: { organizationId } }),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: existingList } = useQuery({
    queryKey: ["performances", organizationId],
    queryFn: () => fetchList({ data: { organizationId } }),
    enabled: open,
    staleTime: 30_000,
  });

  // Map ISO date (yyyy-MM-dd) -> list of event labels for that day
  const eventsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of existingList?.items ?? []) {
      const label = p.name?.trim() || t(`organizations.performances.status.${p.status}`);
      const arr = map.get(p.performance_date) ?? [];
      arr.push(label);
      map.set(p.performance_date, arr);
    }
    return map;
  }, [existingList, t]);

  const eventDates = useMemo(
    () =>
      Array.from(eventsByDate.keys()).map((iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d);
      }),
    [eventsByDate],
  );

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [date, setDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<PerformanceStatus | "">("");
  const [visibility, setVisibility] = useState<PerformanceVisibility>("private");
  // eventKindSelection holds either a preset slug, a custom-kind label, or "__custom__"
  // (sentinel meaning "user is typing a new custom kind into eventKindCustom").
  const [eventKindSelection, setEventKindSelection] = useState<string>("");
  const [eventKindCustom, setEventKindCustom] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [notes, setNotes] = useState("");

  const [contacts, setContacts] = useState<ContactRef[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyRef[]>([]);
  const [suggestedContacts, setSuggestedContacts] = useState<ContactRef[]>([]);
  const [suggestedCounterparties, setSuggestedCounterparties] = useState<CounterpartyRef[]>([]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [cpPickerOpen, setCpPickerOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addCpOpen, setAddCpOpen] = useState(false);

  // Details dialogs triggered from assigned badges
  const [detailsContactId, setDetailsContactId] = useState<string | null>(null);
  const [detailsCpLinkId, setDetailsCpLinkId] = useState<string | null>(null);

  // Prefill state when editing
  useEffect(() => {
    if (!open || !initial) return;
    const [y, m, d] = initial.performance_date.split("-").map(Number);
    setDate(new Date(y, m - 1, d));
    setStatus(initial.status);
    setVisibility(initial.visibility);
    setEventKindSelection(initial.event_kind);
    setEventKindCustom("");
    setName(initial.name ?? "");
    setCity(initial.city ?? "");
    setPostalCode(initial.postal_code ?? "");
    setStreet(initial.street ?? "");
    setStreetNumber(initial.street_number ?? "");
    setGoogleMapsUrl(initial.google_maps_url ?? "");
    setNotes(initial.notes ?? "");
    setContacts(initial.assignments.contacts.map((c) => ({ id: c.id, name: c.name })));
    setCounterparties(initial.assignments.counterparties.map((c) => ({ id: c.id, name: c.name })));
    setSuggestedContacts([]);
    setSuggestedCounterparties([]);
  }, [open, initial]);

  const openCounterpartyDetails = async (cpOrgId: string) => {
    try {
      const res = await findCpLink({
        data: { ownerOrgId: organizationId, counterpartyOrgId: cpOrgId },
      });
      if (res.linkId) setDetailsCpLinkId(res.linkId);
      else toast.error(t("organizations.performances.errors.cp_link_missing"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const isConfirmed = status && CONFIRMED.includes(status as PerformanceStatus);
  const isPublicFull = visibility === "public_full";
  const isCustomKind = eventKindSelection === "__custom__";
  const resolvedEventKind = isCustomKind ? eventKindCustom.trim() : eventKindSelection;

  const reset = () => {
    setDate(undefined);
    setStatus("");
    setVisibility("private");
    setEventKindSelection("");
    setEventKindCustom("");
    setName("");
    setCity("");
    setPostalCode("");
    setStreet("");
    setStreetNumber("");
    setGoogleMapsUrl("");
    setNotes("");
    setContacts([]);
    setCounterparties([]);
    setSuggestedContacts([]);
    setSuggestedCounterparties([]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error(t("organizations.performances.errors.date_required"));
      if (!status) throw new Error(t("organizations.performances.errors.status_required"));
      if (!resolvedEventKind)
        throw new Error(t("organizations.performances.errors.event_kind_required"));
      const payload = {
        organizationId,
        performanceDate: format(date, "yyyy-MM-dd"),
        status: status as PerformanceStatus,
        visibility,
        eventKind: resolvedEventKind,
        name: name.trim() || null,
        city: city.trim() || null,
        postalCode: postalCode.trim() || null,
        street: street.trim() || null,
        streetNumber: streetNumber.trim() || null,
        googleMapsUrl: googleMapsUrl.trim() || null,
        notes: notes.trim() || null,
        contactIds: contacts.map((c) => c.id),
        counterpartyIds: counterparties.map((c) => c.id),
      };
      if (isEdit && initial) {
        return update({ data: { ...payload, performanceId: initial.id } });
      }
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? t("organizations.performances.toasts.updated")
          : t("organizations.performances.toasts.created"),
      );
      qc.invalidateQueries({ queryKey: ["performances", organizationId] });
      qc.invalidateQueries({ queryKey: ["performance-event-kinds", organizationId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Validation flags (UI-side mirror of server schema)
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!date) e.date = t("organizations.performances.errors.date_required");
    if (!status) e.status = t("organizations.performances.errors.status_required");
    if (!resolvedEventKind)
      e.eventKind = t("organizations.performances.errors.event_kind_required");
    if (isConfirmed) {
      if (!name.trim()) e.name = t("organizations.performances.errors.required");
      if (!city.trim()) e.city = t("organizations.performances.errors.required");
      if (!postalCode.trim()) e.postalCode = t("organizations.performances.errors.required");
      if (!street.trim()) e.street = t("organizations.performances.errors.required");
      if (!streetNumber.trim()) e.streetNumber = t("organizations.performances.errors.required");
    }
    if (isPublicFull && !googleMapsUrl.trim()) {
      e.googleMapsUrl = t("organizations.performances.errors.required");
    }
    return e;
  }, [
    date, status, resolvedEventKind, isConfirmed, name, city, postalCode, street, streetNumber,
    isPublicFull, googleMapsUrl, t,
  ]);

  const canSubmit = Object.keys(errors).length === 0 && !mutation.isPending;

  const handlePickContact = async (c: { id: string; display_name: string }) => {
    setContacts((prev) =>
      prev.find((x) => x.id === c.id) ? prev : [...prev, { id: c.id, name: c.display_name }],
    );
    try {
      const res = await fetchLinkedCps({ data: { contactId: c.id } });
      const suggested = (res.items ?? [])
        .map((i) => i.organization)
        .filter((o): o is { id: string; name: string; tax_id: string | null; is_shared: boolean } => !!o)
        .map((o) => ({ id: o.id, name: o.name }));
      setSuggestedCounterparties((prev) => {
        const next = [...prev];
        for (const s of suggested) {
          if (!next.find((x) => x.id === s.id)) next.push(s);
        }
        return next;
      });
    } catch {
      /* non-fatal */
    }
  };

  const handlePickCounterparty = async (o: { id: string; name: string }) => {
    setCounterparties((prev) =>
      prev.find((x) => x.id === o.id) ? prev : [...prev, o],
    );
    try {
      const res = await fetchLinkedContacts({ data: { counterpartyOrgId: o.id } });
      const suggested = (res.items ?? [])
        .map((i) => i.contact)
        .filter((c): c is { id: string; display_name: string; email: string | null; phone: string | null } => !!c)
        .map((c) => ({ id: c.id, name: c.display_name }));
      setSuggestedContacts((prev) => {
        const next = [...prev];
        for (const s of suggested) {
          if (!next.find((x) => x.id === s.id)) next.push(s);
        }
        return next;
      });
    } catch {
      /* non-fatal */
    }
  };

  // Filter out suggestions that are already assigned
  const visibleSuggestedContacts = useMemo(
    () => suggestedContacts.filter((s) => !contacts.find((c) => c.id === s.id)),
    [suggestedContacts, contacts],
  );
  const visibleSuggestedCounterparties = useMemo(
    () => suggestedCounterparties.filter((s) => !counterparties.find((c) => c.id === s.id)),
    [suggestedCounterparties, counterparties],
  );


  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t("organizations.performances.dialog.title_edit")
                : t("organizations.performances.dialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Data */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.date")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date
                      ? format(date, "yyyy-MM-dd")
                      : t("organizations.performances.fields.date_placeholder")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      if (d && d < todayMidnight) {
                        toast.warning(
                          t("organizations.performances.toasts.past_date_warning", {
                            date: format(d, "yyyy-MM-dd"),
                          }),
                        );
                      }
                      if (d) setDatePickerOpen(false);
                    }}
                    initialFocus
                    modifiers={{
                      past: { before: todayMidnight },
                      hasEvent: eventDates,
                    }}
                    modifiersClassNames={{
                      past: "text-destructive/70",
                      hasEvent:
                        "[&>button]:bg-primary/20 [&>button]:text-primary [&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/50 [&>button]:rounded-md",
                    }}
                    components={{
                      DayButton: (props) => {
                        const iso = format(props.day.date, "yyyy-MM-dd");
                        const events = eventsByDate.get(iso);
                        if (!events || events.length === 0) {
                          return <CalendarDayButton {...props} />;
                        }
                        return (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CalendarDayButton {...props} />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="mb-1 font-semibold">
                                  {t("organizations.performances.calendar.day_events_title", { date: iso })}
                                </p>
                                <ul className="space-y-0.5">
                                  {events.map((e, i) => (
                                    <li key={i}>• {e}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      },
                    }}
                    className="p-3 pointer-events-auto [--cell-size:2.5rem]"
                  />
                  <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-sm border border-destructive/50 bg-destructive/10" />
                      <span className="text-destructive/80">
                        {t("organizations.performances.calendar.legend_past")}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-sm bg-primary/15 ring-1 ring-inset ring-primary/40" />
                      <span className="text-primary">
                        {t("organizations.performances.calendar.legend_event")}
                      </span>
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Rodzaj wydarzenia */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.event_kind")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={eventKindSelection}
                onValueChange={(v) => {
                  setEventKindSelection(v);
                  if (v !== "__custom__") setEventKindCustom("");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("organizations.performances.fields.event_kind_placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {PERFORMANCE_EVENT_KIND_PRESETS.filter((k) => k !== "other").map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`organizations.performances.event_kind.${k}`)}
                    </SelectItem>
                  ))}
                  {(kindsList?.items ?? []).map((k) => (
                    <SelectItem key={k.id} value={k.label}>
                      {k.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    {t("organizations.performances.event_kind.other")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {isCustomKind && (
                <Input
                  autoFocus
                  value={eventKindCustom}
                  onChange={(e) => setEventKindCustom(e.target.value)}
                  maxLength={120}
                  placeholder={t("organizations.performances.fields.event_kind_custom_placeholder")}
                />
              )}
            </div>


            {/* Status */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.status")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PerformanceStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("organizations.performances.fields.status_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {PERFORMANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`organizations.performances.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Widoczność */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.visibility")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as PerformanceVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERFORMANCE_VISIBILITIES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`organizations.performances.visibility.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("organizations.performances.fields.visibility_hint")}
              </p>
            </div>

            {/* Nazwa */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.name")}
                {isConfirmed && <span className="text-destructive"> *</span>}
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
            </div>

            {/* Adres */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  {t("organizations.performances.fields.city")}
                  {isConfirmed && <span className="text-destructive"> *</span>}
                </Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("organizations.performances.fields.postal_code")}
                  {isConfirmed && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("organizations.performances.fields.street")}
                  {isConfirmed && <span className="text-destructive"> *</span>}
                </Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>
                  {t("organizations.performances.fields.street_number")}
                  {isConfirmed && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  maxLength={40}
                />
              </div>
            </div>

            {/* Pinezka */}
            <div className="space-y-2">
              <Label>
                {t("organizations.performances.fields.google_maps_url")}
                {isPublicFull && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                type="url"
                placeholder="https://maps.google.com/..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                maxLength={2048}
              />
              <p className="text-xs text-muted-foreground">
                {t("organizations.performances.fields.google_maps_url_hint")}
              </p>
            </div>

            {/* Przypisania */}
            <div className="space-y-3 rounded-md border border-border p-3">
              <Label className="text-sm font-semibold">
                {t("organizations.performances.assignments.title")}
              </Label>

              {/* Kontakty */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("organizations.performances.assignments.contacts")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contacts.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("organizations.performances.assignments.empty")}
                    </span>
                  ) : (
                    contacts.map((c) => (
                      <Badge key={c.id} variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
                        <button
                          type="button"
                          onClick={() => setDetailsContactId(c.id)}
                          className="hover:underline"
                          title={t("organizations.performances.actions.open_details")}
                        >
                          {c.name}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setContacts((prev) => prev.filter((x) => x.id !== c.id))
                          }
                          className="hover:text-destructive"
                          aria-label={t("common.remove")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setContactPickerOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    {t("organizations.performances.assignments.assign_contact")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddContactOpen(true)}
                  >
                    {t("organizations.performances.assignments.add_contact")}
                  </Button>
                </div>
                {visibleSuggestedContacts.length > 0 && (
                  <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {t("organizations.performances.assignments.suggestions_title")}
                    </div>
                    {visibleSuggestedContacts.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {t("organizations.performances.assignments.suggest_assign_contact", { name: s.name })}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2"
                            onClick={() => {
                              setContacts((prev) =>
                                prev.find((x) => x.id === s.id) ? prev : [...prev, s],
                              );
                              setSuggestedContacts((prev) => prev.filter((x) => x.id !== s.id));
                            }}
                          >
                            <Check className="h-3 w-3" />
                            {t("organizations.performances.actions.assign")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() =>
                              setSuggestedContacts((prev) => prev.filter((x) => x.id !== s.id))
                            }
                            aria-label={t("organizations.performances.assignments.dismiss")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kontrahenci */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("organizations.performances.assignments.counterparties")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {counterparties.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("organizations.performances.assignments.empty")}
                    </span>
                  ) : (
                    counterparties.map((o) => (
                      <Badge key={o.id} variant="secondary" className="gap-1">
                        <button
                          type="button"
                          onClick={() => openCounterpartyDetails(o.id)}
                          className="hover:underline"
                          title={t("organizations.performances.actions.open_details")}
                        >
                          {o.name}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCounterparties((prev) => prev.filter((x) => x.id !== o.id))
                          }
                          className="hover:text-destructive"
                          aria-label={t("common.remove")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCpPickerOpen(true)}
                  >
                    <Building2 className="h-4 w-4" />
                    {t("organizations.performances.assignments.assign_counterparty")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddCpOpen(true)}
                  >
                    {t("organizations.performances.assignments.add_counterparty")}
                  </Button>
                </div>
                {visibleSuggestedCounterparties.length > 0 && (
                  <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {t("organizations.performances.assignments.suggestions_title")}
                    </div>
                    {visibleSuggestedCounterparties.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {t("organizations.performances.assignments.suggest_assign_cp", { name: s.name })}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2"
                            onClick={() => {
                              setCounterparties((prev) =>
                                prev.find((x) => x.id === s.id) ? prev : [...prev, s],
                              );
                              setSuggestedCounterparties((prev) => prev.filter((x) => x.id !== s.id));
                            }}
                          >
                            <Check className="h-3 w-3" />
                            {t("organizations.performances.actions.assign")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() =>
                              setSuggestedCounterparties((prev) => prev.filter((x) => x.id !== s.id))
                            }
                            aria-label={t("organizations.performances.assignments.dismiss")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notatki */}
            <div className="space-y-2">
              <Label>{t("organizations.performances.fields.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
                rows={4}
                placeholder={t("organizations.performances.fields.notes_placeholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
              {mutation.isPending
                ? t("common.saving")
                : isEdit
                ? t("organizations.performances.dialog.submit_edit")
                : t("organizations.performances.dialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactPicker
        open={contactPickerOpen}
        onOpenChange={setContactPickerOpen}
        excludeIds={contacts.map((c) => c.id)}
        onPick={handlePickContact}
      />
      <CounterpartyPicker
        open={cpPickerOpen}
        onOpenChange={setCpPickerOpen}
        excludeIds={counterparties.map((c) => c.id)}
        onPick={handlePickCounterparty}
      />

      {/* Add new contact */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("organizations.performances.assignments.add_contact")}</DialogTitle>
          </DialogHeader>
          <ContactForm
            scope={{ kind: "user" }}
            onSaved={(c) => {
              setContacts((prev) =>
                prev.find((x) => x.id === c.id)
                  ? prev
                  : [...prev, { id: c.id, name: c.display_name }],
              );
              setAddContactOpen(false);
            }}
            onCancel={() => setAddContactOpen(false)}
            hideLinksSection
          />
        </DialogContent>
      </Dialog>

      {/* Add new counterparty */}
      <AddCounterpartyDialog
        open={addCpOpen}
        onOpenChange={setAddCpOpen}
        ownerOrgId={organizationId}
      />

      {/* Details from assigned badges */}
      <ContactDetailsDialog
        contactId={detailsContactId}
        scope={{ kind: "org", organizationId }}
        onOpenChange={(o) => !o && setDetailsContactId(null)}
      />
      <CounterpartyDetailsDialog
        linkId={detailsCpLinkId}
        onOpenChange={(o) => !o && setDetailsCpLinkId(null)}
        ownerOrgId={organizationId}
      />
    </>
  );
}

