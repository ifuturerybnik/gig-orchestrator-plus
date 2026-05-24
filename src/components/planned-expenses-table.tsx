import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import {
  createBudgetEntry,
  createPlannedExpense,
  deletePlannedExpense,
  listPlannedExpenses,
  setPlannedExpenseCompleted,
} from "@/lib/organizations.functions";
import { formatAmount } from "@/lib/currencies";
import { CategoryInput } from "@/components/category-input";


interface Props {
  organizationId: string;
  currency: string;
}

const INITIAL_LIMIT = 10;

type PlannedEntry = {
  id: string;
  entry_date: string;
  planned_date: string;
  description: string;
  kind: "income" | "expense";
  amount_gross: number;
  currency: string;
  category?: string | null;
  completed: boolean;
  completed_at?: string | null;
  created_at?: string | null;
  created_by: string;
  author?: { first_name?: string | null; last_name?: string | null } | null;
  completed_author?: { first_name?: string | null; last_name?: string | null } | null;
};


export function PlannedExpensesTable({ organizationId, currency }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const fetchEntries = useServerFn(listPlannedExpenses);
  const createFn = useServerFn(createPlannedExpense);
  const toggleFn = useServerFn(setPlannedExpenseCompleted);
  const deleteFn = useServerFn(deletePlannedExpense);
  const createBudgetFn = useServerFn(createBudgetEntry);

  const queryKey = ["organization-planned", organizationId];
  const budgetKey = ["organization-budget", organizationId];
  const query = useQuery({
    queryKey,
    queryFn: () => fetchEntries({ data: { organizationId } }),
  });

  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [moveCandidate, setMoveCandidate] = useState<PlannedEntry | null>(null);
  const [form, setForm] = useState<{
    description: string;
    kind: "income" | "expense";
    planned_date: Date | undefined;
    amount_gross: string;
    category: string;
  }>({
    description: "",
    kind: "expense",
    planned_date: undefined,
    amount_gross: "",
    category: "",
  });


  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organizationId,
          description: form.description,
          kind: form.kind,
          planned_date: format(form.planned_date as Date, "yyyy-MM-dd"),
          amount_gross: Number(form.amount_gross.replace(",", ".")),
          currency,
          category: form.category.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("organizations.planned.added"));
      setOpen(false);
      setForm({
        description: "",
        kind: "expense",
        planned_date: undefined,
        amount_gross: "",
        category: "",
      });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const toggleMutation = useMutation({
    mutationFn: (v: { entryId: string; completed: boolean }) =>
      toggleFn({ data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteFn({ data: { entryId } }),
    onSuccess: () => {
      toast.success(t("organizations.planned.deleted"));
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async (entry: PlannedEntry) => {
      await createBudgetFn({
        data: {
          organizationId,
          description: entry.description,
          kind: entry.kind,
          amount_gross: entry.amount_gross,
          currency: entry.currency,
          category: entry.category ?? undefined,
        },
      });
      await deleteFn({ data: { entryId: entry.id } });
    },

    onSuccess: () => {
      toast.success(t("organizations.planned.moved"));
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: budgetKey });
      setMoveCandidate(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setMoveCandidate(null);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(form.amount_gross.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error(t("organizations.budget.invalid_amount"));
      return;
    }
    if (!form.planned_date) {
      toast.error(t("organizations.planned.pick_date"));
      return;
    }
    createMutation.mutate();
  };

  const handleToggle = (entry: PlannedEntry, checked: boolean) => {
    if (checked && !entry.completed) {
      setMoveCandidate(entry);
      return;
    }
    toggleMutation.mutate({ entryId: entry.id, completed: checked });
  };

  const entries = (query.data?.entries ?? []) as PlannedEntry[];
  const hasMore = entries.length > INITIAL_LIMIT;
  const visibleEntries = expanded ? entries : entries.slice(0, INITIAL_LIMIT);

  const totals = entries
    .filter((e) => !e.completed)
    .reduce<Record<string, { income: number; expense: number }>>((acc, e) => {
      if (!acc[e.currency]) acc[e.currency] = { income: 0, expense: 0 };
      acc[e.currency][e.kind] += e.amount_gross;
      return acc;
    }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t("organizations.planned.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("organizations.planned.subtitle")}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("organizations.planned.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t("organizations.planned.add")}</DialogTitle>
                <DialogDescription>
                  {t("organizations.budget.currency_used", { currency })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t("organizations.planned.col.planned_date")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.planned_date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.planned_date
                          ? format(form.planned_date, "PPP")
                          : t("organizations.planned.pick_date")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.planned_date}
                        onSelect={(d) =>
                          setForm((f) => ({ ...f, planned_date: d }))
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_category">
                    {t("organizations.budget.col.category")}
                  </Label>
                  <CategoryInput
                    id="p_category"
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    existing={entries.map((e) => e.category)}
                    storageKey={organizationId}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p_description">
                    {t("organizations.planned.col.description")}
                  </Label>
                  <Textarea
                    id="p_description"
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
                  <Label htmlFor="p_amount">
                    {t("organizations.planned.col.amount_gross")} ({currency})
                  </Label>
                  <Input
                    id="p_amount"
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

      <div className="rounded-md border border-border bg-card">
        <div className={expanded ? "max-h-[640px] overflow-auto" : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("organizations.planned.col.date")}</TableHead>
                <TableHead>{t("organizations.planned.col.author")}</TableHead>
                <TableHead>{t("organizations.budget.col.category")}</TableHead>
                <TableHead>
                  {t("organizations.planned.col.description")}
                </TableHead>
                <TableHead>
                  {t("organizations.planned.col.planned_date")}
                </TableHead>
                <TableHead className="text-right">
                  {t("organizations.planned.col.amount_gross")}
                </TableHead>
                <TableHead className="text-center">
                  {t("organizations.planned.col.completed")}
                </TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>

            </TableHeader>
            <TableBody>
              {query.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!query.isLoading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("organizations.planned.empty_list")}
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
                const completed = e.completed;
                return (
                  <TableRow
                    key={e.id}
                    className={cn(completed && "opacity-50")}
                  >
                    <TableCell
                      className={cn(
                        "whitespace-nowrap align-top",
                        completed && "line-through",
                      )}
                    >
                      <div className="flex flex-col leading-tight">
                        <span>
                          {new Date(e.entry_date).toLocaleDateString(i18n.language)}
                        </span>
                        {e.created_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(e.created_at).toLocaleTimeString(i18n.language, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn("text-sm", completed && "line-through")}
                    >
                      {author || t("organizations.members.no_name")}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm text-muted-foreground whitespace-nowrap",
                        completed && "line-through",
                      )}
                    >
                      {e.category || "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "max-w-[260px] whitespace-pre-wrap text-sm",
                        completed && "line-through",
                      )}
                    >
                      {e.description}
                    </TableCell>

                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-sm",
                        completed && "line-through",
                      )}
                    >
                      {new Date(e.planned_date).toLocaleDateString(
                        i18n.language,
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right whitespace-nowrap font-medium",
                        completed && "line-through",
                      )}
                    >
                      <span
                        className={
                          isIncome
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
                          aria-label={t("organizations.planned.col.completed")}
                          className="h-5 w-5"
                          checked={completed}
                          disabled={toggleMutation.isPending}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(v) => handleToggle(e, Boolean(v))}
                        />
                        {completed && e.completed_at && (
                          <span className="text-[10px] leading-tight text-muted-foreground">
                            {(() => {
                              const n = [
                                e.completed_author?.first_name,
                                e.completed_author?.last_name,
                              ]
                                .filter(Boolean)
                                .join(" ")
                                .trim();
                              return n ? (
                                <>
                                  {t("organizations.budget.col.completed_by", { name: n })}
                                  <br />
                                </>
                              ) : null;
                            })()}
                            {new Date(e.completed_at).toLocaleString(i18n.language, {
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
                          if (confirm(t("organizations.planned.delete_confirm"))) {
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
            {entries.length > 0 && Object.keys(totals).length > 0 && (
              <TableFooter>
                {Object.entries(totals).map(([cur, t2]) => {
                  const balance = t2.income - t2.expense;
                  return (
                    <TableRow key={cur}>
                      <TableCell colSpan={5} className="font-semibold">
                        {t("organizations.planned.summary")} ({cur})

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
                            className={cn(
                              "mt-0.5 border-t border-border pt-0.5 text-sm",
                              balance >= 0
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-rose-700 dark:text-rose-300",
                            )}
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
        </div>
        {hasMore && (
          <div className="flex justify-center border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  {t("organizations.planned.collapse")}
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  {t("organizations.planned.expand", {
                    count: entries.length - INITIAL_LIMIT,
                  })}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={moveCandidate !== null}
        onOpenChange={(o) => {
          if (!o) setMoveCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("organizations.planned.move_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.planned.move_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (moveCandidate) {
                  toggleMutation.mutate({
                    entryId: moveCandidate.id,
                    completed: true,
                  });
                }
                setMoveCandidate(null);
              }}
            >
              {t("organizations.planned.move_no")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moveCandidate) moveMutation.mutate(moveCandidate);
              }}
              disabled={moveMutation.isPending}
            >
              {t("organizations.planned.move_yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
