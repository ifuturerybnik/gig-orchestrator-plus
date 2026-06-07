import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OrgTypesText } from "@/components/organizations/OrgTypesText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencySelect } from "@/components/currency-select";
import { PhoneInput } from "@/components/phone-input";
import { CountrySelect } from "@/components/country-select";
import { SecuritySection } from "@/components/security-section";
import { PrivacySection } from "@/components/privacy-section";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { listMyOrganizations } from "@/lib/organizations.functions";
import { StopkiManager } from "@/components/email/StopkiManager";
import { MyMailboxesSection } from "@/components/my-mailboxes-section";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const USER_KINDS = [
  "team_manager",
  "musician",
  "sound_engineer",
  "lighting_engineer",
  "visual_engineer",
  "driver",
  "stage_technician",
  "stage_company_owner",
  "event_company_owner",
  "concert_organizer",
] as const;
type UserKind = (typeof USER_KINDS)[number];

function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const fetchOrgs = useServerFn(listMyOrganizations);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const orgsQuery = useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => fetchOrgs(),
  });

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    user_kinds: [] as UserKind[],
    address_street: "",
    address_city: "",
    address_postal_code: "",
    address_country: "",
    settlement_form: "" as "" | "employment" | "business" | "mandate_contract" | "work_contract" | "other",
    settlement_employer_org_id: "",
    settlement_other_description: "",
    billing_company_name: "",
    billing_tax_id: "",
    billing_is_vat_payer: false,
    billing_bank_account: "",
    billing_pesel: "",
    billing_tax_office: "",
    billing_zus_title: "",
    billing_default_rate: "",
    billing_default_currency: "",
  });

  useEffect(() => {
    const p = profileQuery.data?.profile as Record<string, unknown> | null | undefined;
    if (p) {
      setForm({
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        phone: (p.phone as string) ?? "",
        user_kinds: ((p.user_kinds ?? []) as UserKind[]),
        address_street: (p.address_street as string) ?? "",
        address_city: (p.address_city as string) ?? "",
        address_postal_code: (p.address_postal_code as string) ?? "",
        address_country: (p.address_country as string) ?? "",
        settlement_form: ((p.settlement_form as typeof form.settlement_form) ?? "") || "",
        settlement_employer_org_id: (p.settlement_employer_org_id as string) ?? "",
        settlement_other_description: (p.settlement_other_description as string) ?? "",
        billing_company_name: (p.billing_company_name as string) ?? "",
        billing_tax_id: (p.billing_tax_id as string) ?? "",
        billing_is_vat_payer: Boolean(p.billing_is_vat_payer),
        billing_bank_account: (p.billing_bank_account as string) ?? "",
        billing_pesel: (p.billing_pesel as string) ?? "",
        billing_tax_office: (p.billing_tax_office as string) ?? "",
        billing_zus_title: (p.billing_zus_title as string) ?? "",
        billing_default_rate:
          p.billing_default_rate != null ? String(p.billing_default_rate) : "",
        billing_default_currency: (p.billing_default_currency as string) ?? "",
      });
    }
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: typeof form) => {
      const rate = input.billing_default_rate.trim();
      const payload = {
        ...input,
        settlement_form: input.settlement_form === "" ? null : input.settlement_form,
        settlement_employer_org_id:
          input.settlement_form === "employment" && input.settlement_employer_org_id
            ? input.settlement_employer_org_id
            : null,
        billing_default_rate: rate === "" ? null : Number(rate),
      };
      return updateFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(t("profile.saved"));
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleKind = (kind: UserKind) =>
    setForm((f) => ({
      ...f,
      user_kinds: f.user_kinds.includes(kind)
        ? f.user_kinds.filter((k) => k !== kind)
        : [...f.user_kinds, kind],
    }));

  const orgs = orgsQuery.data?.organizations ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-foreground">{t("profile.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("profile.subtitle")}</p>

        {profileQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">{t("profile.basic")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("auth.register.first_name")}</Label>
                  <Input id="first_name" required maxLength={120} value={form.first_name} onChange={update("first_name")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("auth.register.last_name")}</Label>
                  <Input id="last_name" required maxLength={120} value={form.last_name} onChange={update("last_name")} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="phone">{t("auth.register.phone")}</Label>
                  <PhoneInput
                    id="phone"
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    defaultCountry={form.address_country}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold">{t("profile.kinds.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("profile.kinds.help")}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {USER_KINDS.map((kind) => {
                  const id = `kind-${kind}`;
                  return (
                    <label
                      key={kind}
                      htmlFor={id}
                      className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-accent"
                    >
                      <Checkbox
                        id={id}
                        checked={form.user_kinds.includes(kind)}
                        onCheckedChange={() => toggleKind(kind)}
                      />
                      <span className="text-sm">{t(`user_kinds.${kind}`)}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold">{t("profile.address.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("profile.address.optional")}</p>
              </div>
              <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                {t("profile.address.benefit_user")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address_street">{t("address.street")}</Label>
                  <Input id="address_street" maxLength={200} value={form.address_street} onChange={update("address_street")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_postal_code">{t("address.postal_code")}</Label>
                  <Input id="address_postal_code" maxLength={20} value={form.address_postal_code} onChange={update("address_postal_code")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_city">{t("address.city")}</Label>
                  <Input id="address_city" maxLength={120} value={form.address_city} onChange={update("address_city")} />
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

            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold">{t("profile.settlement.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("profile.settlement.help")}</p>
              </div>

              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground">
                {t("profile.settlement.privacy_note")}
              </p>

              <RadioGroup
                value={form.settlement_form}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, settlement_form: v as typeof f.settlement_form }))
                }
                className="space-y-2"
              >
                {(["employment", "business", "mandate_contract", "work_contract", "other"] as const).map(
                  (sf) => (
                    <label
                      key={sf}
                      htmlFor={`sf-${sf}`}
                      className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent"
                    >
                      <RadioGroupItem id={`sf-${sf}`} value={sf} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          {t(`profile.settlement.forms.${sf}.label`)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`profile.settlement.forms.${sf}.desc`)}
                        </p>
                      </div>
                    </label>
                  ),
                )}
              </RadioGroup>

              {form.settlement_form === "employment" && (
                <div className="space-y-2">
                  <Label htmlFor="settlement_employer_org_id">
                    {t("profile.settlement.employer_org")}
                  </Label>
                  {orgs.length === 0 ? (
                    <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      {t("profile.settlement.no_orgs")}
                    </p>
                  ) : (
                    <Select
                      value={form.settlement_employer_org_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, settlement_employer_org_id: v }))
                      }
                    >
                      <SelectTrigger id="settlement_employer_org_id">
                        <SelectValue placeholder={t("profile.settlement.employer_org_ph")} />
                      </SelectTrigger>
                      <SelectContent>
                        {orgs.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {form.settlement_form === "business" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing_company_name">
                      {t("profile.settlement.company_name")}
                    </Label>
                    <Input
                      id="billing_company_name"
                      maxLength={200}
                      value={form.billing_company_name}
                      onChange={update("billing_company_name")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_tax_id">{t("profile.settlement.tax_id")}</Label>
                    <Input
                      id="billing_tax_id"
                      maxLength={40}
                      value={form.billing_tax_id}
                      onChange={update("billing_tax_id")}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:mt-7">
                    <Checkbox
                      id="billing_is_vat_payer"
                      checked={form.billing_is_vat_payer}
                      onCheckedChange={(c) =>
                        setForm((f) => ({ ...f, billing_is_vat_payer: c === true }))
                      }
                    />
                    <Label htmlFor="billing_is_vat_payer" className="text-sm font-normal">
                      {t("profile.settlement.vat_payer")}
                    </Label>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing_bank_account">
                      {t("profile.settlement.bank_account")}
                    </Label>
                    <Input
                      id="billing_bank_account"
                      maxLength={60}
                      value={form.billing_bank_account}
                      onChange={update("billing_bank_account")}
                      placeholder="PL00 0000 0000 0000 0000 0000 0000"
                    />
                  </div>
                </div>
              )}

              {(form.settlement_form === "mandate_contract" ||
                form.settlement_form === "work_contract") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing_pesel">{t("profile.settlement.pesel")}</Label>
                    <Input
                      id="billing_pesel"
                      maxLength={20}
                      value={form.billing_pesel}
                      onChange={update("billing_pesel")}
                      placeholder="00000000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_tax_office">
                      {t("profile.settlement.tax_office")}
                    </Label>
                    <Input
                      id="billing_tax_office"
                      maxLength={200}
                      value={form.billing_tax_office}
                      onChange={update("billing_tax_office")}
                      placeholder={t("profile.settlement.tax_office_ph")}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing_bank_account">
                      {t("profile.settlement.bank_account")}
                    </Label>
                    <Input
                      id="billing_bank_account"
                      maxLength={60}
                      value={form.billing_bank_account}
                      onChange={update("billing_bank_account")}
                    />
                  </div>
                  {form.settlement_form === "mandate_contract" && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="billing_zus_title">
                        {t("profile.settlement.zus_title")}
                      </Label>
                      <Select
                        value={form.billing_zus_title || "none"}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            billing_zus_title: v === "none" ? "" : v,
                          }))
                        }
                      >
                        <SelectTrigger id="billing_zus_title">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("profile.settlement.zus_titles.none")}
                          </SelectItem>
                          <SelectItem value="student">
                            {t("profile.settlement.zus_titles.student")}
                          </SelectItem>
                          <SelectItem value="employed_elsewhere">
                            {t("profile.settlement.zus_titles.employed_elsewhere")}
                          </SelectItem>
                          <SelectItem value="retired">
                            {t("profile.settlement.zus_titles.retired")}
                          </SelectItem>
                          <SelectItem value="own_business">
                            {t("profile.settlement.zus_titles.own_business")}
                          </SelectItem>
                          <SelectItem value="other">
                            {t("profile.settlement.zus_titles.other")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {form.settlement_form === "other" && (
                <div className="space-y-2">
                  <Label htmlFor="settlement_other_description">
                    {t("profile.settlement.other_desc")}
                  </Label>
                  <Input
                    id="settlement_other_description"
                    maxLength={500}
                    value={form.settlement_other_description}
                    onChange={update("settlement_other_description")}
                  />
                </div>
              )}

              {form.settlement_form && (
                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="billing_default_rate">
                      {t("profile.settlement.default_rate")}
                    </Label>
                    <Input
                      id="billing_default_rate"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.billing_default_rate}
                      onChange={update("billing_default_rate")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_default_currency">
                      {t("profile.settlement.default_currency")}
                    </Label>
                    <CurrencySelect
                      id="billing_default_currency"
                      value={form.billing_default_currency || "PLN"}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, billing_default_currency: v }))
                      }
                    />
                  </div>
                </div>
              )}
            </section>

            <Button type="submit" disabled={mutation.isPending}>
              {t("common.save")}
            </Button>
          </form>
        )}

        <div className="mt-12">
          <MyMailboxesSection />
        </div>

        <div className="mt-12">
          <StopkiManager scope={{ kind: "user" }} />
        </div>

        <div className="mt-12 space-y-8">
          <SecuritySection />
          <PrivacySection userEmail={profileQuery.data?.email} />
        </div>



        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">{t("profile.my_orgs.title")}</h2>
          {orgsQuery.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : orgs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("profile.my_orgs.empty")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link
                    to="/organizations/$orgId"
                    params={{ orgId: org.id }}
                    className="flex items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <OrgTypesText types={(org as { types?: string[] | null }).types} />
                      </p>
                    </div>
                    <Badge
                      variant={
                        org.status === "approved"
                          ? "default"
                          : org.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {t(`organizations.status.${org.status}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
