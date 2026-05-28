import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Users, Building2, CalendarDays, Wallet, Contact, Briefcase } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { listBudgetEntries } from "@/lib/organizations.functions";

type Item = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export function OrgSidebar({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const { t } = useTranslation();
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });

  const fetchEntries = useServerFn(listBudgetEntries);
  const budgetQuery = useQuery({
    queryKey: ["organization-budget", orgId],
    queryFn: () => fetchEntries({ data: { organizationId: orgId } }),
  });
  const pendingExpenseCount =
    budgetQuery.data?.entries.filter(
      (e) =>
        e.kind === "expense" &&
        (e as { completed?: boolean }).completed === false,
    ).length ?? 0;

  const base = `/organizations/${orgId}`;
  const items: Item[] = [
    {
      to: base,
      labelKey: "organizations.sidebar.overview",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: `${base}/events`,
      labelKey: "organizations.sidebar.events",
      icon: CalendarDays,
    },
    {
      to: `${base}/budget`,
      labelKey: "organizations.sidebar.budget",
      icon: Wallet,
    },
    {
      to: `${base}/profile`,
      labelKey: "organizations.sidebar.profile",
      icon: Building2,
    },
    {
      to: `${base}/contacts`,
      labelKey: "organizations.sidebar.contacts",
      icon: Contact,
    },
    {
      to: `${base}/counterparties`,
      labelKey: "organizations.sidebar.counterparties",
      icon: Briefcase,
    },
    {
      to: `${base}/members`,
      labelKey: "organizations.sidebar.members",
      icon: Users,
    },
  ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? currentPath === to : currentPath === to || currentPath.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-foreground">
              {orgName}
            </p>
            <Link
              to="/organizations"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("organizations.sidebar.back_to_list")}
            </Link>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("organizations.sidebar.section")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={t(item.labelKey)}
                    >
                      <Link to={item.to} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{t(item.labelKey)}</span>
                        {item.to === `${base}/budget` && pendingExpenseCount > 0 && (
                          <span
                            aria-label={t("organizations.sidebar.pending_expenses", {
                              count: pendingExpenseCount,
                            })}
                            className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-[16px] group-data-[collapsible=icon]:text-[10px]"
                          >
                            {pendingExpenseCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
