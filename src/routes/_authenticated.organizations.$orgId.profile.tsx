import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CountrySelect } from "@/components/country-select";
import { CurrencySelect } from "@/components/currency-select";
import { MUSIC_GENRES } from "@/lib/genres";
import { currencyForCountry } from "@/lib/currencies";
import {
  getOrganizationDetails,
  updateOrganization,
} from "@/lib/organizations.functions";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/profile",
)({
  component: OrganizationProfilePage,
});

function OrganizationProfilePage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const updateFn = useServerFn(updateOrganization);

  const queryKey = ["organization", orgId];
  const detailsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    address_street: "",
    address_city: "",
    address_postal_code: "",
    address_country: "",
    genres: [] as string[],
    currency: "PLN",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && detailsQuery.data) {
      const org = detailsQuery.data.organization;
      setForm({
        name: org.name,
        description: org.description ?? "",
        address_street: org.address_street ?? "",
        address_city: org.address_city ?? "",
        address_postal_code: org.address_postal_code ?? "",
        address_country: org.address_country ?? "",
        genres: Array.isArray(org.genres) ? [...org.genres] : [],
        currency: org.currency ?? currencyForCountry(org.address_country),
      });
      setInitialized(true);
    }
  }, [detailsQuery.data, initialized]);

  const updateMutation = useMutation({
    mutationFn: (input: typeof form) =>
      updateFn({ data: { organizationId: orgId, ...input } }),
    onSuccess: () => {
      toast.success(t("organizations.detail.saved"));
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
      navigate({ to: "/organizations/$orgId", params: { orgId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detailsQuery.isLoading || !initialized) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {detailsQuery.error instanceof Error
          ? detailsQuery.error.message
          : t("common.error")}
      </p>
    );
  }

  const { organization: org, canManage } = detailsQuery.data;

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("organizations.detail.no_permission", {
          defaultValue: "Brak uprawnień do edycji.",
        })}
      </p>
    );
  }

  const toggleGenre = (g: string) =>
    setForm((f) => ({
      ...f,
      genres: f.genres.includes(g)
        ? f.genres.filter((x) => x !== g)
        : [...f.genres, g],
    }));

  const updateField =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {t("organizations.sidebar.profile")}
      </h1>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("organizations.detail.basic")}</h2>
        <div className="space-y-2">
          <Label htmlFor="name">{t("organizations.form.name")}</Label>
          <Input
            id="name"
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={updateField("name")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">{t("organizations.form.description")}</Label>
          <Textarea
            id="desc"
            rows={4}
            maxLength={2000}
            value={form.description}
            onChange={updateField("description")}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t("organizations.detail.address.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("organizations.detail.address.optional")}
          </p>
        </div>
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          {t("organizations.detail.address.benefit")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_street">{t("address.street")}</Label>
            <Input
              id="address_street"
              maxLength={200}
              value={form.address_street}
              onChange={updateField("address_street")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_postal_code">{t("address.postal_code")}</Label>
            <Input
              id="address_postal_code"
              maxLength={20}
              value={form.address_postal_code}
              onChange={updateField("address_postal_code")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_city">{t("address.city")}</Label>
            <Input
              id="address_city"
              maxLength={120}
              value={form.address_city}
              onChange={updateField("address_city")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_country">{t("address.country")}</Label>
            <CountrySelect
              id="address_country"
              value={form.address_country}
              onChange={(v) => setForm((f) => ({ ...f, address_country: v }))}
            />
          </div>
        </div>
      </section>

      {org.type === "band" && (
        <section className="space-y-4 rounded-md border border-border bg-card p-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t("organizations.detail.genres.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("organizations.detail.genres.help")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MUSIC_GENRES.map((g) => {
              const checked = form.genres.includes(g);
              return (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleGenre(g)}
                  />
                  <span>{t(`organizations.genres.${g}`)}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          {t("organizations.detail.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            navigate({ to: "/organizations/$orgId", params: { orgId } })
          }
        >
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
