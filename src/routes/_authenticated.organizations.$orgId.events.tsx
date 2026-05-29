import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Plus, Eye, EyeOff, Users, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PerformanceDialog } from "@/components/performances/PerformanceDialog";
import {
  listPerformances,
  type PerformanceStatus,
  type PerformanceVisibility,
} from "@/lib/performances.functions";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/events",
)({
  component: OrganizationPerformancesPage,
});

const statusVariant: Record<PerformanceStatus, "default" | "secondary" | "outline"> = {
  inquiry: "outline",
  tentative: "secondary",
  confirmed_signing: "default",
  confirmed_signed: "default",
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

  const fetchList = useServerFn(listPerformances);
  const { data, isLoading } = useQuery({
    queryKey: ["performances", orgId],
    queryFn: () => fetchList({ data: { organizationId: orgId } }),
  });

  const items = data?.items ?? [];

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
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("organizations.performances.add")}
        </Button>
      </div>

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
                <TableHead>{t("organizations.performances.col.status")}</TableHead>
                <TableHead>{t("organizations.performances.col.name")}</TableHead>
                <TableHead>{t("organizations.performances.col.city")}</TableHead>
                <TableHead>{t("organizations.performances.col.assignments")}</TableHead>
                <TableHead className="w-12">{t("organizations.performances.col.visibility")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.performance_date}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status as PerformanceStatus]}>
                      {t(`organizations.performances.status.${p.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.name ?? "—"}</TableCell>
                  <TableCell>{p.city ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.assignments.contacts.map((c) => (
                        <Badge key={`c-${c.id}`} variant="outline" className="text-xs">
                          {c.name}
                        </Badge>
                      ))}
                      {p.assignments.counterparties.map((o) => (
                        <Badge key={`o-${o.id}`} variant="secondary" className="text-xs">
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PerformanceDialog open={open} onOpenChange={setOpen} organizationId={orgId} />
    </div>
  );
}
