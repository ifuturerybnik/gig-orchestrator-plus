import { Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMyProfile } from "@/lib/profile.functions";
import logoUrl from "@/assets/logo.png";

export function Header() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const isAdmin = profileQuery.data?.isAdmin === true;
  const mfaRecommended = profileQuery.data?.mfaRecommended === true;

  const mfaQuery = useQuery({
    queryKey: ["my-mfa-factors", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
    enabled: !!user && mfaRecommended,
    staleTime: 60_000,
  });
  const hasMfa = !!mfaQuery.data?.totp?.some((f) => f.status === "verified");
  const showMfaWarning = mfaRecommended && !mfaQuery.isLoading && !hasMfa;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center">
          <img src={logoUrl} alt={t("app.name")} className="h-8 w-auto" />
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
              <Link to="/contacts" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.contacts")}
              </Link>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/profile"
                      className="relative inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t("nav.profile")}
                      {showMfaWarning && (
                        <span
                          aria-label={t("security.mfa.warning_aria")}
                          className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
                        >
                          !
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {showMfaWarning && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs leading-snug">
                        {t("security.mfa.warning_tooltip")}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              {isAdmin && (
                <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
                  {t("nav.admin")}
                </Link>
              )}
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
