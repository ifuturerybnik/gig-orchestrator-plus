import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = { id: string; status: string; friendly_name?: string | null };

export function SecuritySection() {
  const { t } = useTranslation();

  // Password change
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const submitPwd = async (e: FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error(t("auth.errors.weak_password"));
    if (pwd !== pwd2) return toast.error(t("auth.errors.passwords_mismatch"));
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPwdLoading(false);
    if (error) return toast.error(error.message);
    setPwd("");
    setPwd2("");
    toast.success(t("security.password.changed"));
  };

  // MFA / TOTP
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFactors = async () => {
    setLoadingMfa(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoadingMfa(false);
    if (error) return;
    setFactors((data?.totp ?? []) as Factor[]);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const startEnroll = async () => {
    setBusy(true);
    // Clean up any leftover unverified factor first
    const unverified = factors.find((f) => f.status === "unverified");
    if (unverified) await supabase.auth.mfa.unenroll({ factorId: unverified.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `TOTP ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Error");
    setEnrollData({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verifyEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({
      factorId: enrollData.factorId,
    });
    if (challenge.error || !challenge.data) {
      setBusy(false);
      return toast.error(challenge.error?.message ?? "Error");
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verify.error) return toast.error(verify.error.message);
    setEnrollData(null);
    setCode("");
    toast.success(t("security.mfa.enabled"));
    await loadFactors();
  };

  const cancelEnroll = async () => {
    if (!enrollData) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setEnrollData(null);
    setCode("");
    await loadFactors();
  };

  const disable = async () => {
    if (!verifiedFactor) return;
    if (!confirm(t("security.mfa.disable_confirm"))) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactor.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("security.mfa.disabled"));
    await loadFactors();
  };

  return (
    <>
      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("security.password.title")}</h2>
        <form onSubmit={submitPwd} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new_pwd">{t("security.password.new")}</Label>
            <Input
              id="new_pwd"
              type="password"
              minLength={8}
              required
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_pwd2">{t("security.password.confirm")}</Label>
            <Input
              id="new_pwd2"
              type="password"
              minLength={8}
              required
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pwdLoading}>
              {t("security.password.change")}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold">{t("security.mfa.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("security.mfa.help")}</p>
        </div>

        {loadingMfa ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : verifiedFactor ? (
          <div className="flex items-center justify-between gap-4 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm text-foreground">{t("security.mfa.enabled_state")}</p>
            <Button variant="destructive" onClick={disable} disabled={busy}>
              {t("security.mfa.disable")}
            </Button>
          </div>
        ) : enrollData ? (
          <form onSubmit={verifyEnroll} className="space-y-4">
            <p className="text-sm text-foreground">{t("security.mfa.scan_help")}</p>
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-background p-4">
              <img
                src={enrollData.qr}
                alt="TOTP QR"
                className="h-48 w-48 rounded-md bg-white p-2"
              />
              <p className="text-xs text-muted-foreground">
                {t("security.mfa.secret_label")}:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  {enrollData.secret}
                </code>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp_code">{t("security.mfa.code_label")}</Label>
              <Input
                id="totp_code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={cancelEnroll} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("security.mfa.verify")}
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={startEnroll} disabled={busy}>
            {t("security.mfa.enable")}
          </Button>
        )}
      </section>
    </>
  );
}
