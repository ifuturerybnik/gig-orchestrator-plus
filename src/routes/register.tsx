import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/phone-input";

import { recordSignupConsents } from "@/lib/consents.functions";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { useForceLightTheme } from "@/hooks/use-force-light-theme";


export const Route = createFileRoute("/register")({
  component: RegisterPage,
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

function RegisterPage() {
  useForceLightTheme();
  const { t, i18n } = useTranslation();
  const recordConsents = useServerFn(recordSignupConsents);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const toggleKind = (kind: string) => {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  const handleAccount = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.errors.weak_password"));
      return;
    }
    if (password !== passwordConfirm) {
      toast.error(t("auth.errors.passwords_mismatch"));
      return;
    }
    if (!acceptLegal) {
      toast.error(t("auth.errors.legal_required"));
      return;
    }
    setStep(2);
  };

  const handleProfile = (e: FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleKinds = async (e: FormEvent) => {
    e.preventDefault();
    if (kinds.length === 0) {
      toast.error(t("auth.errors.select_at_least_one_kind"));
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          user_kinds: kinds,
          preferred_language: i18n.language,
        },
      },
    });
    if (error) {
      setLoading(false);
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        toast.error(t("auth.errors.email_already_registered"));
      } else {
        toast.error(error.message);
      }
      return;
    }
    // Supabase ze względów bezpieczeństwa NIE zwraca błędu jeśli e-mail jest już zajęty —
    // zwraca usera z pustą tablicą identities. Wykrywamy ten przypadek ręcznie.
    const identities = (signUpData.user as { identities?: unknown[] } | null)?.identities;
    if (signUpData.user && Array.isArray(identities) && identities.length === 0) {
      setLoading(false);
      toast.error(t("auth.errors.email_already_registered"));
      return;
    }
    // Audit log zgód (RODO). Nie blokujemy rejestracji w razie błędu — logujemy.
    if (signUpData.user?.id) {
      try {
        await recordConsents({
          data: {
            user_id: signUpData.user.id,
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            marketing_granted: acceptMarketing,
          },
        });
      } catch (consentErr) {
        console.error("Failed to record signup consents", consentErr);
      }
    }
    setLoading(false);
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">{t("auth.register.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.register.step_account")} · {t("auth.register.step_profile")} ·{" "}
          {t("auth.register.step_kinds")} ({step}/3)
        </p>

        {done ? (
          <div className="mt-8 rounded-md border border-border bg-card p-6 text-sm text-foreground">
            {t("auth.register.check_email")}
          </div>
        ) : step === 1 ? (
          <div className="mt-6">
            <form onSubmit={handleAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.register.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.register.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2">{t("auth.register.password_confirm")}</Label>
              <Input
                id="password2"
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
              {t("auth.register.mfa_recommendation")}
            </div>
            <label
              htmlFor="accept-legal"
              className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"
            >
              <Checkbox
                id="accept-legal"
                checked={acceptLegal}
                onCheckedChange={(c) => setAcceptLegal(c === true)}
              />
              <span>
                {t("auth.register.accept_legal_prefix")}{" "}
                <Link to="/terms" target="_blank" className="text-foreground underline">
                  {t("footer.terms")}
                </Link>{" "}
                {t("auth.register.accept_legal_and")}{" "}
                <Link to="/privacy" target="_blank" className="text-foreground underline">
                  {t("footer.privacy")}
                </Link>
                . <span className="text-destructive">*</span>
              </span>
            </label>
            <label
              htmlFor="accept-marketing"
              className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"
            >
              <Checkbox
                id="accept-marketing"
                checked={acceptMarketing}
                onCheckedChange={(c) => setAcceptMarketing(c === true)}
              />
              <span className="text-muted-foreground">
                {t("auth.register.accept_marketing")}
              </span>
            </label>
            <Button type="submit" className="w-full">
              {t("common.next")}
            </Button>
          </form>
          </div>
        ) : step === 2 ? (
          <form onSubmit={handleProfile} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first">{t("auth.register.first_name")}</Label>
              <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last">{t("auth.register.last_name")}</Label>
              <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("auth.register.phone")}</Label>
              <PhoneInput id="phone" value={phone} onChange={setPhone} />

            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button type="submit" className="flex-1">
                {t("common.next")}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleKinds} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("auth.register.kinds_help")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {USER_KINDS.map((kind) => (
                <label
                  key={kind}
                  className="flex items-center gap-2 rounded-md border border-border p-3 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={kinds.includes(kind)}
                    onCheckedChange={() => toggleKind(kind)}
                  />
                  <span>{t(`user_kinds.${kind}`)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                {t("common.back")}
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {t("auth.register.submit")}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.register.have_account")}{" "}
          <Link to="/login" className="text-foreground underline">
            {t("auth.register.login_link")}
          </Link>
        </div>
      </main>
    </div>
  );
}
