import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Wallet,
  Contact,
  Briefcase,
  Inbox,
  Mail,
  Bot,
  Share2,
  Globe,
  Megaphone,
  Sparkles,
  HardDrive,
  MessageCircle,
  ChevronDown,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { listBudgetEntries, getMyOrgPermissions } from "@/lib/organizations.functions";
import { countOrgUnreadMail } from "@/lib/mail-counts.functions";
import { hasModuleAccess, type OrgModuleId } from "@/lib/org-modules";

type LeafItem = {
  kind: "leaf";
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  moduleId?: OrgModuleId;
};

type GroupItem = {
  kind: "group";
  id: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  children: LeafItem[];
};

type Item = LeafItem | GroupItem;

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
    budgetQuery.data?.entries?.filter(
      (e) =>
        e.kind === "expense" &&
        (e as { completed?: boolean }).completed === false,
    ).length ?? 0;

  const fetchPerms = useServerFn(getMyOrgPermissions);
  const permsQuery = useQuery({
    queryKey: ["org-my-permissions", orgId],
    queryFn: () => fetchPerms({ data: { organizationId: orgId } }),
  });
  const perms = permsQuery.data?.permissions ?? null;

  const fetchUnreadMail = useServerFn(countOrgUnreadMail);
  const unreadMailQuery = useQuery({
    queryKey: ["org-unread-mail", orgId],
    queryFn: () => fetchUnreadMail({ data: { organizationId: orgId } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unreadMail = unreadMailQuery.data?.unread ?? 0;

  const base = `/organizations/${orgId}`;
  const allItems: Item[] = [
    {
      kind: "leaf",
      to: `${base}/events`,
      labelKey: "organizations.sidebar.events",
      icon: CalendarDays,
      moduleId: "events",
    },
    {
      kind: "leaf",
      to: `${base}/budget`,
      labelKey: "organizations.sidebar.budget",
      icon: Wallet,
      moduleId: "budget",
    },
    {
      kind: "leaf",
      to: `${base}/contacts`,
      labelKey: "organizations.sidebar.contacts",
      icon: Contact,
      moduleId: "contacts",
    },
    {
      kind: "leaf",
      to: `${base}/counterparties`,
      labelKey: "organizations.sidebar.counterparties",
      icon: Briefcase,
      moduleId: "counterparties",
    },
    {
      kind: "group",
      id: "correspondence",
      labelKey: "organizations.sidebar.correspondence",
      icon: Inbox,
      children: [
        {
          kind: "leaf",
          to: `${base}/mail`,
          labelKey: "organizations.sidebar.mail",
          icon: Mail,
          moduleId: "mail",
        },
        {
          kind: "leaf",
          to: `${base}/autokorespondencja`,
          labelKey: "organizations.sidebar.autokorespondencja",
          icon: Bot,
          moduleId: "autokorespondencja",
        },
      ],
    },
    {
      kind: "group",
      id: "media_web",
      labelKey: "organizations.sidebar.media_web",
      icon: Megaphone,
      children: [
        {
          kind: "leaf",
          to: `${base}/ai-studio`,
          labelKey: "organizations.sidebar.ai_studio",
          icon: Sparkles,
          moduleId: "ai_studio",
        },
        {
          kind: "leaf",
          to: `${base}/social`,
          labelKey: "organizations.sidebar.social",
          icon: Share2,
          moduleId: "social",
        },
        {
          kind: "leaf",
          to: `${base}/web`,
          labelKey: "organizations.sidebar.web",
          icon: Globe,
          moduleId: "web",
        },
      ],
    },
    {
      kind: "leaf",
      to: `${base}/assistant`,
      labelKey: "organizations.sidebar.assistant",
      icon: MessageCircle,
      moduleId: "assistant",
    },
    {
      kind: "leaf",
      to: `${base}/dysk`,
      labelKey: "organizations.sidebar.dysk",
      icon: HardDrive,
      moduleId: "dysk",
    },
    {
      kind: "leaf",
      to: `${base}/members`,
      labelKey: "organizations.sidebar.members",
      icon: Users,
      moduleId: "members",
    },
  ];

  const canSee = (m?: OrgModuleId) => (m ? hasModuleAccess(perms, m) : true);
  const items: Item[] = allItems
    .map((item) => {
      if (item.kind === "group") {
        const visibleChildren = item.children.filter((c) => canSee(c.moduleId));
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      return canSee(item.moduleId) ? item : null;
    })
    .filter((i): i is Item => i !== null);

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
                if (item.kind === "group") {
                  const GroupIcon = item.icon;
                  const groupActive = item.children.some((c) => isActive(c.to));
                  return (
                    <Collapsible
                      key={item.id}
                      defaultOpen={groupActive}
                      className="group/collapsible"
                      asChild
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={t(item.labelKey)}
                            isActive={groupActive}
                            className="w-full"
                          >
                            <GroupIcon className="h-4 w-4" />
                            <span className="flex-1 text-left">
                              {t(item.labelKey)}
                            </span>
                            {item.id === "correspondence" && unreadMail > 0 && (
                              <span
                                aria-label={String(unreadMail)}
                                className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-[16px] group-data-[collapsible=icon]:text-[10px]"
                              >
                                {unreadMail}
                              </span>
                            )}
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const childActive = isActive(child.to);
                              const showMailBadge =
                                child.moduleId === "mail" && unreadMail > 0;
                              return (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={childActive}
                                  >
                                    <Link
                                      to={child.to}
                                      className="flex items-center gap-2"
                                    >
                                      <ChildIcon className="h-4 w-4" />
                                      <span className="flex-1">{t(child.labelKey)}</span>
                                      {showMailBadge && (
                                        <span
                                          aria-label={String(unreadMail)}
                                          className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-none text-white"
                                        >
                                          {unreadMail}
                                        </span>
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

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
