import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMyProfile } from "@/lib/profile.functions";
import {
  listPendingOrganizations,
  listPendingOrgChangeRequests,
} from "@/lib/organizations.functions";
import { listJoinRequests } from "@/lib/counterparties.functions";
import logoUrl from "@/assets/logo.png";

export function Header() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
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

  const fetchPendingOrgs = useServerFn(listPendingOrganizations);
  const fetchJoinReqs = useServerFn(listJoinRequests);
  const fetchPendingChanges = useServerFn(listPendingOrgChangeRequests);
  const pendingOrgsQuery = useQuery({
    queryKey: ["pending-organizations"],
    queryFn: () => fetchPendingOrgs(),
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const joinReqsQuery = useQuery({
    queryKey: ["pending-join-requests"],
    queryFn: () => fetchJoinReqs(),
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const pendingChangesQuery = useQuery({
    queryKey: ["pending-org-changes"],
    queryFn: () => fetchPendingChanges(),
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const pendingCount =
    (pendingOrgsQuery.data?.organizations?.length ?? 0) +
    (joinReqsQuery.data?.requests?.length ?? 0) +
    (pendingChangesQuery.data?.requests?.length ?? 0);


  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex h-14 w-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center">
            <img src={logoUrl} alt={t("app.name")} className="h-8 w-auto" />
          </Link>
        </div>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/organizations" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.organizations")}
              </Link>
              <Link to="/contacts" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.contacts")}
              </Link>
              <Link to="/correspondence" className="text-sm text-muted-foreground hover:text-foreground">
                {t("nav.correspondence")}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="relative inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("nav.admin")}
                  {pendingCount > 0 && (
                    <span
                      aria-label={String(pendingCount)}
                      className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
                    >
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )}
              <ThemeSwitcher />
              <LanguageSwitcher />
              {(() => {
                const profile = profileQuery.data?.profile as
                  | { avatar_url?: string | null; first_name?: string; last_name?: string }
                  | undefined;
                const firstName = profile?.first_name ?? "";
                const lastName = profile?.last_name ?? "";
                const initials =
                  (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() ||
                  (user.email ?? "?").charAt(0).toUpperCase();
                const fullName = [firstName, lastName].filter(Boolean).join(" ") || (user.email ?? "");
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to="/profile"
                          className="relative flex items-center gap-2 rounded-full px-2 py-1 hover:bg-accent"
                          title={t("nav.profile")}
                        >
                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {fullName}
                          </span>
                          {showMfaWarning && (
                            <span
                              aria-label={t("security.mfa.warning_aria")}
                              className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
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
                );
              })()}

            </>
          ) : (
            <>
              <ThemeSwitcher />
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
