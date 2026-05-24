import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { CountrySelect } from "@/components/country-select";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";


export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_postal_code: "",
    address_country: "",
  });

  useEffect(() => {
    const p = profileQuery.data?.profile;
    if (p) {
      setForm({
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        phone: p.phone ?? "",
        address_street: p.address_street ?? "",
        address_city: p.address_city ?? "",
        address_postal_code: p.address_postal_code ?? "",
        address_country: p.address_country ?? "",
      });
    }
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: (input: typeof form) => updateFn({ data: input }),
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

            <Button type="submit" disabled={mutation.isPending}>
              {t("common.save")}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
