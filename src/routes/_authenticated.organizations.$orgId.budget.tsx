import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  getOrganizationDetails,
  listBudgetEntries,
} from "@/lib/organizations.functions";
import { formatAmount } from "@/lib/currencies";

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

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    kind: "income" as "income" | "expense",
    amount_gross: "",
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

  // Podsumowanie per waluta (na wypadek mieszanych wpisów historycznych).
  const totals = entries.reduce<
    Record<string, { income: number; expense: number }>
  >((acc, e) => {
    if (!acc[e.currency]) acc[e.currency] = { income: 0, expense: 0 };
    acc[e.currency][e.kind as "income" | "expense"] += e.amount_gross;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("organizations.budget.col.date")}</TableHead>
              <TableHead>{t("organizations.budget.col.author")}</TableHead>
              <TableHead>{t("organizations.budget.col.description")}</TableHead>
              <TableHead>{t("organizations.budget.col.kind")}</TableHead>
              <TableHead className="text-right">
                {t("organizations.budget.col.amount_gross")}
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgetQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            )}
            {!budgetQuery.isLoading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
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
            {entries.map((e) => {
              const author = [e.author?.first_name, e.author?.last_name]
                .filter(Boolean)
                .join(" ")
                .trim();
              const isIncome = e.kind === "income";
              return (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(e.entry_date).toLocaleDateString(i18n.language)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {author || t("organizations.members.no_name")}
                  </TableCell>
                  <TableCell className="max-w-[300px] whitespace-pre-wrap text-sm">
                    {e.description}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium " +
                        (isIncome
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
                        isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }
                    >
                      {isIncome ? "+" : "−"}
                      {formatAmount(e.amount_gross, e.currency, i18n.language)}
                    </span>
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
          {entries.length > 0 && (
            <TableFooter>
              {Object.entries(totals).map(([cur, t2]) => {
                const balance = t2.income - t2.expense;
                return (
                  <TableRow key={cur}>
                    <TableCell colSpan={4} className="font-semibold">
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
                    <TableCell />
                  </TableRow>
                );
              })}
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
