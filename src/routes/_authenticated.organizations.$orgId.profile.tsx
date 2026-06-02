import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CountrySelect } from "@/components/country-select";
import { CurrencySelect } from "@/components/currency-select";
import { PhoneInput } from "@/components/phone-input";
import { MUSIC_GENRES } from "@/lib/genres";
import { currencyForCountry } from "@/lib/currencies";
import {
  cancelOrganizationDeletion,
  getOrganizationDetails,
  requestOrganizationDeletion,
  updateOrganization,
} from "@/lib/organizations.functions";
import { OrgMailboxesSection } from "@/components/org-mailboxes-section";
import { StopkiManager } from "@/components/email/StopkiManager";
import { OrgStorageSection } from "@/components/organizations/OrgStorageSection";


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
    genre: "" as string, // SINGLE genre now
    currency: "PLN",
    legal_name: "",
    tax_id: "",
    registration_number: "",
    court_register_number: "",
    bank_account: "",
    bank_name: "",
    signatory_name: "",
    signatory_position: "",
    contact_email: "",
    contact_phone: "",
    website: "",
  });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && detailsQuery.data) {
      const org = detailsQuery.data.organization as Record<string, unknown>;
      const genresArr = Array.isArray(org.genres) ? (org.genres as string[]) : [];
      setForm({
        name: String(org.name ?? ""),
        description: String(org.description ?? ""),
        address_street: String(org.address_street ?? ""),
        address_city: String(org.address_city ?? ""),
        address_postal_code: String(org.address_postal_code ?? ""),
        address_country: String(org.address_country ?? ""),
        genre: genresArr[0] ?? "",
        currency:
          (org.currency as string | null) ??
          currencyForCountry(org.address_country as string | null),
        legal_name: String(org.legal_name ?? ""),
        tax_id: String(org.tax_id ?? ""),
        registration_number: String(org.registration_number ?? ""),
        court_register_number: String(org.court_register_number ?? ""),
        bank_account: String(org.bank_account ?? ""),
        bank_name: String(org.bank_name ?? ""),
        signatory_name: String(org.signatory_name ?? ""),
        signatory_position: String(org.signatory_position ?? ""),
        contact_email: String(org.contact_email ?? ""),
        contact_phone: String(org.contact_phone ?? ""),
        website: String(org.website ?? ""),
      });
      setInitialized(true);
    }
  }, [detailsQuery.data, initialized]);

  const updateMutation = useMutation({
    mutationFn: (input: typeof form) => {
      const { genre, ...rest } = input;
      return updateFn({
        data: {
          organizationId: orgId,
          ...rest,
          genres: genre ? [genre] : [],
        },
      });
    },
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

  const updateField =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
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
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  address_country: v,
                  currency: currencyForCountry(v),
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t("organizations.detail.company.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("organizations.detail.company.help")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legal_name">
              {t("organizations.detail.company.legal_name")}
            </Label>
            <Input
              id="legal_name"
              maxLength={200}
              value={form.legal_name}
              onChange={updateField("legal_name")}
              placeholder={t("organizations.detail.company.legal_name_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_id">
              {t("organizations.detail.company.tax_id")}
            </Label>
            <Input
              id="tax_id"
              maxLength={40}
              value={form.tax_id}
              onChange={updateField("tax_id")}
              placeholder="PL1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration_number">
              {t("organizations.detail.company.registration_number")}
            </Label>
            <Input
              id="registration_number"
              maxLength={40}
              value={form.registration_number}
              onChange={updateField("registration_number")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="court_register_number">
              {t("organizations.detail.company.court_register_number")}
            </Label>
            <Input
              id="court_register_number"
              maxLength={40}
              value={form.court_register_number}
              onChange={updateField("court_register_number")}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bank_account">
              {t("organizations.detail.company.bank_account")}
            </Label>
            <Input
              id="bank_account"
              maxLength={60}
              value={form.bank_account}
              onChange={updateField("bank_account")}
              placeholder="PL00 0000 0000 0000 0000 0000 0000"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bank_name">
              {t("organizations.detail.company.bank_name")}
            </Label>
            <Input
              id="bank_name"
              maxLength={120}
              value={form.bank_name}
              onChange={updateField("bank_name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signatory_name">
              {t("organizations.detail.company.signatory_name")}
            </Label>
            <Input
              id="signatory_name"
              maxLength={200}
              value={form.signatory_name}
              onChange={updateField("signatory_name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signatory_position">
              {t("organizations.detail.company.signatory_position")}
            </Label>
            <Input
              id="signatory_position"
              maxLength={120}
              value={form.signatory_position}
              onChange={updateField("signatory_position")}
              placeholder={t("organizations.detail.company.signatory_position_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">
              {t("organizations.detail.company.contact_email")}
            </Label>
            <Input
              id="contact_email"
              type="email"
              maxLength={255}
              value={form.contact_email}
              onChange={updateField("contact_email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">
              {t("organizations.detail.company.contact_phone")}
            </Label>
            <PhoneInput
              id="contact_phone"
              value={form.contact_phone}
              onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))}
              defaultCountry={form.address_country}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="website">
              {t("organizations.detail.company.website")}
            </Label>
            <Input
              id="website"
              type="url"
              maxLength={255}
              value={form.website}
              onChange={updateField("website")}
              placeholder="https://"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t("organizations.detail.currency.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("organizations.detail.currency.help")}
          </p>
        </div>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="currency">{t("organizations.detail.currency.label")}</Label>
          <CurrencySelect
            id="currency"
            value={form.currency}
            onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
          />
        </div>
      </section>

      {Array.isArray(org.types) && (org.types as string[]).includes("artist") && (
        <section className="space-y-4 rounded-md border border-border bg-card p-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t("organizations.detail.genres.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("organizations.detail.genres.help_single")}
            </p>
          </div>
          <RadioGroup
            value={form.genre}
            onValueChange={(v) => setForm((f) => ({ ...f, genre: v }))}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {MUSIC_GENRES.map((g) => (
              <label
                key={g}
                htmlFor={`genre-${g}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm hover:bg-muted/50"
              >
                <RadioGroupItem id={`genre-${g}`} value={g} />
                <span>{t(`organizations.genres.${g}`)}</span>
              </label>
            ))}
          </RadioGroup>
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
    <OrgMailboxesSection orgId={orgId} />
    <StopkiManager scope={{ kind: "org", organizationId: orgId }} />
    <OrgStorageSection orgId={orgId} />
    </div>

  );
}
