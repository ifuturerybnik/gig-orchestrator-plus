import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MemberPermissionsDialog } from "@/components/organizations/MemberPermissionsDialog";
import { OrgPermissionsFields } from "@/components/organizations/OrgPermissionsFields";
import {
  type AiStudioPermissionMode,
  type BudgetPermissionMode,
  type EventsPermissionMode,
  type OrgModuleId,
} from "@/lib/org-modules";
import {
  cancelInvitation,
  getOrganizationDetails,
  inviteUserToOrganization,
  promoteMemberToOwner,
  removeOrganizationMember,
} from "@/lib/organizations.functions";


export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/members",
)({
  component: OrganizationMembersPage,
});

function OrganizationMembersPage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const inviteFn = useServerFn(inviteUserToOrganization);
  const removeFn = useServerFn(removeOrganizationMember);
  const cancelFn = useServerFn(cancelInvitation);
  const promoteFn = useServerFn(promoteMemberToOwner);


  const queryKey = ["organization", orgId];
  const detailsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAsOwner, setInviteAsOwner] = useState(false);
  const [inviteIsOrgAdmin, setInviteIsOrgAdmin] = useState(false);
  const [inviteModules, setInviteModules] = useState<Set<OrgModuleId>>(
    () => new Set(),
  );
  const [inviteBudgetMode, setInviteBudgetMode] = useState<BudgetPermissionMode>("full");
  const [inviteEventsMode, setInviteEventsMode] = useState<EventsPermissionMode>("full");
  const [inviteAiStudioMode, setInviteAiStudioMode] = useState<AiStudioPermissionMode>("full");
  const [permMember, setPermMember] = useState<{ id: string; label: string } | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteFn({
        data: {
          organizationId: orgId,
          email: inviteEmail,
          access: {
            asOwner: inviteAsOwner,
            isOrgAdmin: inviteIsOrgAdmin,
            modules: Array.from(inviteModules),
            budgetMode: inviteBudgetMode,
            eventsMode: inviteEventsMode,
          },
        },
      }),
    onSuccess: () => {
      toast.success(t("organizations.members.invitation_sent"));
      setInviteEmail("");
      setInviteAsOwner(false);
      setInviteIsOrgAdmin(false);
      setInviteModules(new Set());
      setInviteBudgetMode("full");
      setInviteEventsMode("full");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeFn({ data: { memberId } }),
    onSuccess: () => {
      toast.success(t("organizations.members.member_removed"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => cancelFn({ data: { invitationId } }),
    onSuccess: () => {
      toast.success(t("organizations.members.invitation_cancelled"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoteMutation = useMutation({
    mutationFn: (memberId: string) => promoteFn({ data: { memberId } }),
    onSuccess: () => {
      toast.success(t("organizations.members.promoted_to_owner"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });



  if (detailsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {detailsQuery.error instanceof Error
          ? detailsQuery.error.message
          : t("common.error")}
      </p>
    );
  }

  const { members, invitations, canManage, isOwner } = detailsQuery.data;

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate();
  };

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("organizations.members.title")}
        </h1>
        <ul className="mt-4 space-y-2">
          {members.map((m) => {
            const fullName = [m.profile?.first_name, m.profile?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim();
            return (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {fullName || t("organizations.members.no_name")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `organizations.members.${m.role === "owner" ? "owner" : "member"}`,
                    )}
                  </p>
                </div>
                {canManage && m.role !== "owner" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t("organizations.permissions.edit")}
                      onClick={() =>
                        setPermMember({
                          id: m.id,
                          label: fullName || t("organizations.members.no_name"),
                        })
                      }
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("organizations.members.promote_confirm"))) {
                            promoteMutation.mutate(m.id);
                          }
                        }}
                        disabled={promoteMutation.isPending}
                      >
                        {t("organizations.members.promote_to_owner")}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("organizations.members.remove_confirm"))) {
                          removeMutation.mutate(m.id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                    >
                      {t("organizations.members.remove")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section>
          <h2 className="text-xl font-semibold text-foreground">
            {t("organizations.members.pending_invitations")}
          </h2>

          <form onSubmit={handleInvite} className="mt-3 space-y-4 rounded-md border border-border bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder={t("organizations.members.email_placeholder")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={inviteMutation.isPending}>
                {t("organizations.members.invite")}
              </Button>
            </div>
            {isOwner && (
              <div className="flex items-center justify-between rounded-md border border-border bg-card/40 p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="invite-as-owner" className="cursor-pointer">
                    {t("organizations.members.invite_as_owner")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("organizations.members.invite_as_owner_help")}
                  </p>
                </div>
                <Switch
                  id="invite-as-owner"
                  checked={inviteAsOwner}
                  onCheckedChange={setInviteAsOwner}
                />
              </div>
            )}
            {!inviteAsOwner && (
              <div>
                <p className="mb-3 text-sm font-medium text-foreground">
                  {t("organizations.members.initial_access")}
                </p>
                <OrgPermissionsFields
                  isOrgAdmin={inviteIsOrgAdmin}
                  onIsOrgAdminChange={setInviteIsOrgAdmin}
                  modules={inviteModules}
                  onModulesChange={setInviteModules}
                  budgetMode={inviteBudgetMode}
                  onBudgetModeChange={setInviteBudgetMode}
                  eventsMode={inviteEventsMode}
                  onEventsModeChange={setInviteEventsMode}
                  aiStudioMode={inviteAiStudioMode}
                  onAiStudioModeChange={setInviteAiStudioMode}
                  fieldIdPrefix="invite-permissions"
                />
              </div>
            )}
          </form>

          {invitations.length > 0 && (
            <ul className="mt-4 space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {inv.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("organizations.members.expires")}:{" "}
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          t("organizations.members.cancel_invitation_confirm"),
                        )
                      ) {
                        cancelMutation.mutate(inv.id);
                      }
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    {t("organizations.members.cancel_invitation")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}


      <MemberPermissionsDialog
        memberId={permMember?.id ?? null}
        memberLabel={permMember?.label ?? ""}
        organizationId={orgId}
        onClose={() => setPermMember(null)}
      />
    </div>
  );
}
