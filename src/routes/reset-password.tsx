import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setMode("set");
  }, []);

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  const handleSet = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.errors.weak_password"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("common.success"));
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">{t("auth.reset.title")}</h1>
        {mode === "request" ? (
          sent ? (
            <p className="mt-6 rounded-md border border-border bg-card p-4 text-sm">
              {t("auth.reset.sent")}
            </p>
          ) : (
            <form onSubmit={handleRequest} className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">{t("auth.reset.request_subtitle")}</p>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.reset.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {t("auth.reset.send")}
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={handleSet} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("auth.reset.set_subtitle")}</p>
            <div className="space-y-2">
              <Label htmlFor="pw">{t("auth.reset.new_password")}</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {t("auth.reset.set")}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
