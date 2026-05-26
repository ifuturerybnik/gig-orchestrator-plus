import { Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/logo.png";

export function Header() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="font-semibold text-foreground">
          {t("app.name")}
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.dashboard")}
              </Link>
              <Link to="/organizations" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.organizations")}
              </Link>
              <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.profile")}
              </Link>
              <LanguageSwitcher />

              <Button variant="ghost" size="sm" onClick={handleLogout}>
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t("nav.register")}</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
