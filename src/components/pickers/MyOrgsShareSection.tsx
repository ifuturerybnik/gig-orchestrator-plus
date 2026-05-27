import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2 } from "lucide-react";
import { listMyOrganizationsForSharing } from "@/lib/org-sharing.functions";

interface Props {
  /** Wybrane organizacje (kontrolowane). Null = jeszcze nie zainicjalizowane. */
  selectedOrgIds: string[] | null;
  onChange: (ids: string[]) => void;
  /** Override tytułu sekcji. */
  title?: string;
  /** Override pomocniczego opisu. */
  helpText?: string;
  /** Gdy true (domyślnie): jeśli `selectedOrgIds === null` i nie ma istniejących wartości, ustaw wszystkie. */
  defaultAllChecked?: boolean;
  /** Lista bieżących powiązań z DB (tryb edycji). Jeśli podana, inicjalizuje selectedOrgIds. */
  initialSelected?: string[] | null;
}

/**
 * Wspólna sekcja "Moje organizacje" do dialogu kontrahenta/kontaktu.
 * Renderuje się tylko jeśli user należy do co najmniej jednej organizacji.
 */
export function MyOrgsShareSection({
  selectedOrgIds,
  onChange,
  title,
  helpText,
  defaultAllChecked = true,
  initialSelected,
}: Props) {
  const { t } = useTranslation();
  const listFn = useServerFn(listMyOrganizationsForSharing);

  const { data, isLoading } = useQuery({
    queryKey: ["my-organizations-for-sharing"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const orgs = useMemo(() => data?.organizations ?? [], [data]);

  // Inicjalizacja: jeśli nie mamy jeszcze wartości — ustaw albo wszystkie, albo initialSelected.
  useEffect(() => {
    if (selectedOrgIds !== null) return;
    if (orgs.length === 0) return;
    if (initialSelected !== undefined && initialSelected !== null) {
      onChange(initialSelected);
    } else if (defaultAllChecked) {
      onChange(orgs.map((o) => o.id));
    } else {
      onChange([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs, initialSelected, defaultAllChecked]);

  if (isLoading) return null;
  if (orgs.length === 0) return null;

  const selected = new Set(selectedOrgIds ?? []);

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(Array.from(next));
  };

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">
        {title ?? t("sharing.my_orgs_title")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {helpText ?? t("sharing.my_orgs_help")}
      </p>
      <ul className="space-y-1.5 pt-1">
        {orgs.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50">
              <Checkbox
                checked={selected.has(o.id)}
                onCheckedChange={(c) => toggle(o.id, c === true)}
              />
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{o.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
