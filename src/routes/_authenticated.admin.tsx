import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, CheckSquare } from "lucide-react";
import { Header } from "@/components/header";
import { getMyProfile } from "@/lib/profile.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useTranslation();
  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  const isAdmin = profileQuery.data?.isAdmin === true;
  const isSuperAdmin = profileQuery.data?.isSuperAdmin === true;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  type NavItem = { to: string; label: string; icon: typeof Shield; show: boolean };
  const items: NavItem[] = [
    {
      to: "/admin/administrators",
      label: t("admin.nav.administrators"),
      icon: Shield,
      show: isSuperAdmin,
    },
    {
      to: "/admin/approvals",
      label: t("admin.nav.approvals"),
      icon: CheckSquare,
      show: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="w-56 shrink-0">
          <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("admin.title")}
          </h2>
          <nav className="space-y-1">
            {items
              .filter((i) => i.show)
              .map((i) => {
                const active = pathname === i.to || pathname.startsWith(i.to + "/");
                return (
                  <Link
                    key={i.to}
                    to={i.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <i.icon className="h-4 w-4" />
                    {i.label}
                  </Link>
                );
              })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
