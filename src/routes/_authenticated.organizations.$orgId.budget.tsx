import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBudgetEntry,
  deleteBudgetEntry,
  getMyOrgPermissions,
  getOrganizationDetails,
  listBudgetEntries,
  setBudgetEntryCompleted,
} from "@/lib/organizations.functions";

import { formatAmount } from "@/lib/currencies";
import { PlannedExpensesTable } from "@/components/planned-expenses-table";
import { CategoryInput } from "@/components/category-input";


export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/budget",
)({
  component: OrganizationBudgetPage,
});

function OrganizationBudgetPage() {
  const { orgId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const fetchEntries = useServerFn(listBudgetEntries);
  const createFn = useServerFn(createBudgetEntry);
  const deleteFn = useServerFn(deleteBudgetEntry);
  const toggleFn = useServerFn(setBudgetEntryCompleted);


  const detailsQuery = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const budgetKey = ["organization-budget", orgId];
  const budgetQuery = useQuery({
    queryKey: budgetKey,
    queryFn: () => fetchEntries({ data: { organizationId: orgId } }),
  });

  const orgCurrency = detailsQuery.data?.organization.currency ?? "PLN";

  const COLLAPSED_LIMIT = 10;
  const PAGE_SIZE = 100;
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [completeCandidate, setCompleteCandidate] = useState<string | null>(null);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    kind: "income" as "income" | "expense",
    amount_gross: "",
    category: "",
    completed: true,
  });



  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organizationId: orgId,
          entry_date: form.entry_date,
          description: form.description,
          kind: form.kind,
          amount_gross: Number(form.amount_gross.replace(",", ".")),
          currency: orgCurrency,
          category: form.category.trim() || undefined,
          completed: form.completed,
        },
      }),
    onSuccess: () => {
      toast.success(t("organizations.budget.added"));
      setOpen(false);
      setForm({
        entry_date: new Date().toISOString().slice(0, 10),
        description: "",
        kind: "income",
        amount_gross: "",
        category: "",
        completed: true,
      });
      queryClient.invalidateQueries({ queryKey: budgetKey });
    },


    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteFn({ data: { entryId } }),
    onSuccess: () => {
      toast.success(t("organizations.budget.deleted"));
      queryClient.invalidateQueries({ queryKey: budgetKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { entryId: string; completed: boolean }) =>
      toggleFn({ data: v }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: budgetKey });
      const previous = queryClient.getQueryData<{
        entries: Array<{ id: string; completed?: boolean }>;
      }>(budgetKey);
      queryClient.setQueryData<{
        entries: Array<{ id: string; completed?: boolean }>;
      }>(budgetKey, (old) =>
        old
          ? {
              ...old,
              entries: old.entries.map((entry) =>
                entry.id === v.entryId ? { ...entry, completed: v.completed } : entry,
              ),
            }
          : old,
      );
      return { previous };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKey }),
    onError: (e: Error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(budgetKey, context.previous);
      toast.error(e.message);
    },
  });


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(form.amount_gross.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error(t("organizations.budget.invalid_amount"));
      return;
    }
    createMutation.mutate();
  };

  const entries = budgetQuery.data?.entries ?? [];

  // ===== Filtry =====
  type DateFilter =
    | "all"
    | "this_month"
    | "prev_month"
    | "this_year"
    | "prev_year"
    | "custom";
  type CompletedFilter = "all" | "yes" | "no";
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>("all");

  const dateRange = useMemo<{ from: Date; to: Date } | null>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    switch (dateFilter) {
      case "this_month":
        return { from: new Date(y, m, 1), to: endOfDay(new Date(y, m + 1, 0)) };
      case "prev_month":
        return { from: new Date(y, m - 1, 1), to: endOfDay(new Date(y, m, 0)) };
      case "this_year":
        return { from: new Date(y, 0, 1), to: endOfDay(new Date(y, 11, 31)) };
      case "prev_year":
        return { from: new Date(y - 1, 0, 1), to: endOfDay(new Date(y - 1, 11, 31)) };
      case "custom":
        if (customRange?.from) {
          return {
            from: startOfDay(customRange.from),
            to: endOfDay(customRange.to ?? customRange.from),
          };
        }
        return null;
      case "all":
      default:
        return null;
    }
  }, [dateFilter, customRange]);

  const authorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      const cb = (e as { created_by?: string }).created_by;
      if (!cb) continue;
      if (!map.has(cb)) {
        const name = [e.author?.first_name, e.author?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        map.set(cb, name || t("organizations.members.no_name"));
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries, t]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const c = (e as { category?: string | null }).category;
      if (c && c.trim()) set.add(c.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (dateRange) {
        const d = new Date(e.entry_date);
        if (d < dateRange.from || d > dateRange.to) return false;
      }
      if (
        authorFilter !== "all" &&
        (e as { created_by?: string }).created_by !== authorFilter
      )
        return false;
      if (categoryFilter !== "all") {
        const c = ((e as { category?: string | null }).category ?? "").trim();
        if (c !== categoryFilter) return false;
      }
      if (completedFilter !== "all") {
        const completed = (e as { completed?: boolean }).completed !== false;
        if (completedFilter === "yes" && !completed) return false;
        if (completedFilter === "no" && completed) return false;
      }
      return true;
    });
  }, [entries, dateRange, authorFilter, categoryFilter, completedFilter]);

  const filtersActive =
    dateFilter !== "all" ||
    authorFilter !== "all" ||
    categoryFilter !== "all" ||
    completedFilter !== "all";

  const clearFilters = () => {
    setDateFilter("all");
    setCustomRange(undefined);
    setAuthorFilter("all");
    setCategoryFilter("all");
    setCompletedFilter("all");
  };

  // Reset infinite-scroll window when filters change or collapsed
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [dateFilter, customRange, authorFilter, categoryFilter, completedFilter, expanded]);

  const visibleEntries = expanded
    ? filteredEntries.slice(0, visibleCount)
    : filteredEntries.slice(0, COLLAPSED_LIMIT);
  const canExpand = filteredEntries.length > COLLAPSED_LIMIT;
  const hasMore = expanded && filteredEntries.length > visibleEntries.length;

  // Auto-load next page when sentinel becomes visible (only when expanded)
  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filteredEntries.length]);


  const totals = filteredEntries
    .filter((e) => (e as { completed?: boolean }).completed !== false)
    .reduce<Record<string, { income: number; expense: number }>>((acc, e) => {
      if (!acc[e.currency]) acc[e.currency] = { income: 0, expense: 0 };
      acc[e.currency][e.kind as "income" | "expense"] += e.amount_gross;
      return acc;
    }, {});


  return (
    <div className="space-y-6">
      <p className="text-lg font-bold text-foreground">
        {t("organizations.budget.intro")}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("organizations.budget.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("organizations.budget.subtitle")}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("organizations.budget.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t("organizations.budget.add")}</DialogTitle>
                <DialogDescription>
                  {t("organizations.budget.currency_used", {
                    currency: orgCurrency,
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="entry_date">
                      {t("organizations.budget.col.date")}
                    </Label>
                    <Input
                      id="entry_date"
                      type="date"
                      required
                      value={form.entry_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, entry_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kind">
                      {t("organizations.budget.col.kind")}
                    </Label>
                    <Select
                      value={form.kind}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          kind: v as "income" | "expense",
                        }))
                      }
                    >
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">
                          {t("organizations.budget.kind.income")}
                        </SelectItem>
                        <SelectItem value="expense">
                          {t("organizations.budget.kind.expense")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    {t("organizations.budget.col.category")}
                  </Label>
                  <CategoryInput
                    id="category"
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    existing={entries.map((e) => e.category)}
                    storageKey={orgId}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    {t("organizations.budget.col.description")}
                  </Label>
                  <Textarea
                    id="description"
                    required
                    maxLength={500}
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>


                <div className="space-y-2">
                  <Label htmlFor="amount_gross">
                    {t("organizations.budget.col.amount_gross")} ({orgCurrency})
                  </Label>
                  <Input
                    id="amount_gross"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    required
                    value={form.amount_gross}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount_gross: e.target.value }))
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="completed"
                    checked={form.completed}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, completed: Boolean(v) }))
                    }
                  />
                  <Label htmlFor="completed" className="cursor-pointer">
                    {t("organizations.budget.col.completed")}
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ===== Filtry ===== */}
      <div className="rounded-md border border-border bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("organizations.budget.filters.date")}
            </Label>
            <Select
              value={dateFilter}
              onValueChange={(v) => setDateFilter(v as typeof dateFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("organizations.budget.filters.date_all")}
                </SelectItem>
                <SelectItem value="this_month">
                  {t("organizations.budget.filters.date_this_month")}
                </SelectItem>
                <SelectItem value="prev_month">
                  {t("organizations.budget.filters.date_prev_month")}
                </SelectItem>
                <SelectItem value="this_year">
                  {t("organizations.budget.filters.date_this_year")}
                </SelectItem>
                <SelectItem value="prev_year">
                  {t("organizations.budget.filters.date_prev_year")}
                </SelectItem>
                <SelectItem value="custom">
                  {t("organizations.budget.filters.date_custom")}
                </SelectItem>
              </SelectContent>
            </Select>
            {dateFilter === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "mt-1 w-full justify-start text-left font-normal",
                      !customRange?.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "dd.MM.yyyy")} —{" "}
                          {format(customRange.to, "dd.MM.yyyy")}
                        </>
                      ) : (
                        format(customRange.from, "dd.MM.yyyy")
                      )
                    ) : (
                      t("organizations.budget.filters.pick_range")
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={2}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("organizations.budget.filters.author")}
            </Label>
            <Select value={authorFilter} onValueChange={setAuthorFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("organizations.budget.filters.author_all")}
                </SelectItem>
                {authorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("organizations.budget.filters.category")}
            </Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("organizations.budget.filters.category_all")}
                </SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("organizations.budget.filters.completed")}
            </Label>
            <Select
              value={completedFilter}
              onValueChange={(v) =>
                setCompletedFilter(v as typeof completedFilter)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("organizations.budget.filters.completed_all")}
                </SelectItem>
                <SelectItem value="yes">
                  {t("organizations.budget.filters.completed_yes")}
                </SelectItem>
                <SelectItem value="no">
                  {t("organizations.budget.filters.completed_no")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col justify-end gap-1">
            <span className="text-xs text-muted-foreground">
              {t("organizations.budget.filters.results", {
                count: filteredEntries.length,
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!filtersActive}
            >
              <X className="mr-1 h-4 w-4" />
              {t("organizations.budget.filters.clear")}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>

          <TableHeader>
            <TableRow>
              <TableHead>{t("organizations.budget.col.date")}</TableHead>
              <TableHead>{t("organizations.budget.col.author")}</TableHead>
              <TableHead>{t("organizations.budget.col.category")}</TableHead>
              <TableHead>{t("organizations.budget.col.description")}</TableHead>
              <TableHead>{t("organizations.budget.col.kind")}</TableHead>
              <TableHead className="text-right">
                {t("organizations.budget.col.amount_gross")}
              </TableHead>
              <TableHead className="text-center">
                {t("organizations.budget.col.completed")}
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgetQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            )}
            {!budgetQuery.isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>

                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("organizations.budget.empty_list")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {visibleEntries.map((e) => {
              const author = [e.author?.first_name, e.author?.last_name]
                .filter(Boolean)
                .join(" ")
                .trim();
              const isIncome = e.kind === "income";
              const completed =
                (e as { completed?: boolean }).completed !== false;
              const completedAt = (e as { completed_at?: string | null }).completed_at;
              const completedAuthor = (e as {
                completed_author?: { first_name?: string | null; last_name?: string | null } | null;
              }).completed_author;
              const completedAuthorName = [
                completedAuthor?.first_name,
                completedAuthor?.last_name,
              ]
                .filter(Boolean)
                .join(" ")
                .trim();
              const createdAt = (e as { created_at?: string | null }).created_at;
              const rowClass = cn(
                !completed && "text-rose-600 dark:text-rose-400",
              );
              return (
                <TableRow key={e.id} className={rowClass}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col leading-tight">
                      <span>
                        {new Date(e.entry_date).toLocaleDateString(i18n.language)}
                      </span>
                      {createdAt && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(createdAt).toLocaleTimeString(i18n.language, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {author || t("organizations.members.no_name")}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm whitespace-nowrap",
                      completed && "text-muted-foreground",
                    )}
                  >
                    {(e as { category?: string | null }).category || "—"}
                  </TableCell>
                  <TableCell className="max-w-[300px] whitespace-pre-wrap text-sm">
                    {e.description}
                  </TableCell>

                  <TableCell>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium " +
                        (!completed
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : isIncome
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400")
                      }
                    >
                      {isIncome ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {t(`organizations.budget.kind.${e.kind}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium">
                    <span
                      className={
                        !completed
                          ? "text-rose-600 dark:text-rose-400"
                          : isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                      }
                    >
                      {isIncome ? "+" : "−"}
                      {formatAmount(e.amount_gross, e.currency, i18n.language)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center align-top">
                    <div className="flex flex-col items-center gap-0.5">
                      <Checkbox
                        aria-label={t("organizations.budget.col.completed")}
                        className="h-5 w-5"
                        checked={completed}
                        disabled={completed || toggleMutation.isPending}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(v) => {
                          if (completed) return;
                          if (Boolean(v)) setCompleteCandidate(e.id);
                        }}
                      />
                      {completed && completedAt && (
                        <span className="text-[10px] leading-tight text-muted-foreground">
                          {completedAuthorName && (
                            <>
                              {t("organizations.budget.col.completed_by", {
                                name: completedAuthorName,
                              })}
                              <br />
                            </>
                          )}
                          {new Date(completedAt).toLocaleString(i18n.language, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t("organizations.budget.delete_confirm"))) {
                          deleteMutation.mutate(e.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {filteredEntries.length > 0 && Object.keys(totals).length > 0 && (
            <TableFooter>
              {Object.entries(totals).map(([cur, t2]) => {
                const balance = t2.income - t2.expense;
                return (
                  <TableRow key={cur}>
                    <TableCell colSpan={5} className="font-semibold">
                      {t("organizations.budget.summary")} ({cur})

                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <div className="flex flex-col items-end gap-0.5 text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          + {formatAmount(t2.income, cur, i18n.language)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400">
                          − {formatAmount(t2.expense, cur, i18n.language)}
                        </span>
                        <span
                          className={
                            "mt-0.5 border-t border-border pt-0.5 text-sm " +
                            (balance >= 0
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300")
                          }
                        >
                          = {formatAmount(balance, cur, i18n.language)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>

                );
              })}
            </TableFooter>
          )}
        </Table>
        {hasMore && (
          <div
            ref={loadMoreRef}
            className="flex justify-center border-t border-border p-3 text-xs text-muted-foreground"
          >
            {t("organizations.budget.loading_more", {
              remaining: filteredEntries.length - visibleEntries.length,
            })}
          </div>
        )}
        {canExpand && (
          <div className="flex justify-center border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  {t("organizations.budget.collapse")}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  {t("organizations.budget.expand", {
                    count: filteredEntries.length - COLLAPSED_LIMIT,
                  })}
                </>
              )}
            </Button>
          </div>
        )}

      </div>

      <PlannedExpensesTable organizationId={orgId} currency={orgCurrency} />

      <AlertDialog
        open={completeCandidate !== null}
        onOpenChange={(o) => {
          if (!o) setCompleteCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organizations.budget.confirm_complete_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.budget.confirm_complete_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("organizations.budget.confirm_complete_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (completeCandidate) {
                  toggleMutation.mutate({
                    entryId: completeCandidate,
                    completed: true,
                  });
                }
                setCompleteCandidate(null);
              }}
            >
              {t("organizations.budget.confirm_complete_yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
