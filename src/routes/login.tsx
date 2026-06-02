import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trustDevice, isDeviceTrusted } from "@/lib/mfa-trust";
import { useForceLightTheme } from "@/hooks/use-force-light-theme";


export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  useForceLightTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  // MFA challenge state
  const [mfaStep, setMfaStep] = useState<null | { factorId: string; userId: string }>(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(t("auth.errors.invalid_credentials"));
      return;
    }

    // Check whether MFA is required
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const userId = data.user?.id;
    if (aal.data && aal.data.nextLevel === "aal2" && aal.data.currentLevel === "aal1" && userId) {
      // Trusted device? Skip prompt.
      if (remember && isDeviceTrusted(userId)) {
        setLoading(false);
        navigate({ to: "/dashboard" });
        return;
      }
      const factors = await supabase.auth.mfa.listFactors();
      const totp = factors.data?.totp?.find((f) => f.status === "verified");
      setLoading(false);
      if (!totp) {
        navigate({ to: "/dashboard" });
        return;
      }
      setMfaStep({ factorId: totp.id, userId });
      return;
    }

    setLoading(false);
    navigate({ to: "/dashboard" });
  };

  const handleMfa = async (e: FormEvent) => {
    e.preventDefault();
    if (!mfaStep) return;
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaStep.factorId });
    if (challenge.error || !challenge.data) {
      setLoading(false);
      toast.error(challenge.error?.message ?? "Error");
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: mfaStep.factorId,
      challengeId: challenge.data.id,
      code: mfaCode.trim(),
    });
    setLoading(false);
    if (verify.error) {
      toast.error(t("auth.mfa.invalid_code"));
      return;
    }
    if (remember) trustDevice(mfaStep.userId);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">{t("auth.login.title")}</h1>

        {mfaStep ? (
          <form onSubmit={handleMfa} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("auth.mfa.prompt")}</p>
            <div className="space-y-2">
              <Label htmlFor="mfa">{t("auth.mfa.code")}</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
              />
              <span>{t("auth.login.remember_device")}</span>
            </label>
            <Button type="submit" className="w-full" disabled={loading}>
              {t("auth.mfa.verify")}
            </Button>
          </form>
        ) : (
          <div className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.login.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.login.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {t("auth.login.submit")}
            </Button>
          </form>
          </div>
        )}



        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/reset-password" className="text-muted-foreground hover:text-foreground">
            {t("auth.login.forgot")}
          </Link>
          <span className="text-muted-foreground">
            {t("auth.login.no_account")}{" "}
            <Link to="/register" className="text-foreground underline">
              {t("auth.login.register_link")}
            </Link>
          </span>
        </div>
      </main>
    </div>
  );
}
