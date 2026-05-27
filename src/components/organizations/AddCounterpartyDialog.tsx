import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { normalizeOrgName } from "@/lib/normalizeOrgName";
import {
  checkOrgNameAvailability,
  addCounterpartyLink,
} from "@/lib/counterparty-links.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MatchOrg = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  address_city: string | null;
  address_country: string | null;
  address_street: string | null;
  address_building_no: string | null;
  address_postal_code: string | null;
};

export function AddCounterpartyDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const checkFn = useServerFn(checkOrgNameAvailability);
  const addFn = useServerFn(addCounterpartyLink);

  const [name, setName] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(name.trim()), 350);
    return () => clearTimeout(id);
  }, [name]);

  const normalizedPreview = useMemo(() => normalizeOrgName(name), [name]);
  const canSearch = debounced.length >= 2 && normalizedPreview.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["org-name-availability", debounced],
    queryFn: () => checkFn({ data: { name: debounced } }),
    enabled: open && canSearch,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: (counterpartyOrgId: string) =>
      addFn({ data: { counterpartyOrgId } }),
    onSuccess: () => {
      toast.success(t("organizations.counterparties.dialog.added"));
      queryClient.invalidateQueries({ queryKey: ["my-counterparties"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : String(err));
    },
  });

  const exact = data?.exact ?? [];
  const similar = data?.similar ?? [];
  const hasMatches = exact.length > 0 || similar.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("organizations.counterparties.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("organizations.counterparties.dialog.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cp-name">
            {t("organizations.counterparties.dialog.name_label")}
          </Label>
          <Input
            id="cp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("organizations.counterparties.dialog.name_placeholder")}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {t("organizations.counterparties.dialog.name_help")}
          </p>
        </div>

        {canSearch && (
          <div className="space-y-3">
            {isFetching ? (
              <p className="text-sm text-muted-foreground">
                {t("organizations.counterparties.dialog.searching")}
              </p>
            ) : hasMatches ? (
              <>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  {exact.length > 0
                    ? t("organizations.counterparties.dialog.found_exact")
                    : t("organizations.counterparties.dialog.found_similar")}
                </div>
                <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {[...exact, ...similar].map((org) => (
                    <MatchRow
                      key={org.id}
                      org={org as MatchOrg}
                      isExact={exact.some((e) => e.id === org.id)}
                      busy={addMutation.isPending}
                      onAdd={() => addMutation.mutate(org.id)}
                    />
                  ))}
                </ul>
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  {t("organizations.counterparties.dialog.not_matching_hint")}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t("organizations.counterparties.dialog.no_matches")}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled
            title={t("organizations.counterparties.dialog.continue_soon_tooltip")}
          >
            {t("organizations.counterparties.dialog.continue_new")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchRow({
  org,
  isExact,
  busy,
  onAdd,
}: {
  org: MatchOrg;
  isExact: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const addressLine = [
    [org.address_postal_code, org.address_city].filter(Boolean).join(" "),
    [org.address_street, org.address_building_no].filter(Boolean).join(" "),
    org.address_country,
  ]
    .filter((s) => s && s.length > 0)
    .join(" · ");
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="font-medium text-foreground truncate">{org.name}</p>
          {isExact && (
            <Badge variant="default" className="text-[10px]">
              {t("organizations.counterparties.dialog.badge_exact")}
            </Badge>
          )}
        </div>
        {org.legal_name && org.legal_name !== org.name && (
          <p className="text-xs text-muted-foreground truncate">
            {org.legal_name}
          </p>
        )}
        {org.tax_id && (
          <p className="text-xs text-muted-foreground">NIP: {org.tax_id}</p>
        )}
        {addressLine && (
          <p className="text-xs text-muted-foreground truncate">{addressLine}</p>
        )}
      </div>
      <Button size="sm" onClick={onAdd} disabled={busy}>
        {t("organizations.counterparties.dialog.add_btn")}
      </Button>
    </li>
  );
}
