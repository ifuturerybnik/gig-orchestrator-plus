import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  cancelInvitation,
  getOrganizationDetails,
  inviteUserToOrganization,
  removeOrganizationMember,
  updateOrganization,
} from "@/lib/organizations.functions";

export const Route = createFileRoute("/_authenticated/organizations/$orgId")({
  component: OrganizationDetailPage,
});

function OrganizationDetailPage() {
  const { orgId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const fetchDetails = useServerFn(getOrganizationDetails);
  const inviteFn = useServerFn(inviteUserToOrganization);
  const updateFn = useServerFn(updateOrganization);
  const removeFn = useServerFn(removeOrganizationMember);
  const cancelFn = useServerFn(cancelInvitation);

  const queryKey = ["organization", orgId];
  const detailsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address_street: "",
    address_city: "",
    address_postal_code: "",
    address_country: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateMutation = useMutation({
    mutationFn: (input: typeof form) =>
      updateFn({ data: { organizationId: orgId, ...input } }),
    onSuccess: () => {
      toast.success(t("organizations.detail.saved"));
      setEditing(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["my-organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      inviteFn({ data: { organizationId: orgId, email } }),
    onSuccess: () => {
      toast.success(t("organizations.members.invitation_sent"));
      setInviteEmail("");
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

  if (detailsQuery.isLoading) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </Shell>
    );
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <Shell>
        <p className="text-sm text-destructive">
          {detailsQuery.error instanceof Error
            ? detailsQuery.error.message
            : t("common.error")}
        </p>
      </Shell>
    );
  }

  const { organization: org, members, invitations, canManage } = detailsQuery.data;

  const startEdit = () => {
    setForm({
      name: org.name,
      description: org.description ?? "",
      address_street: org.address_street ?? "",
      address_city: org.address_city ?? "",
      address_postal_code: org.address_postal_code ?? "",
      address_country: org.address_country ?? "",
    });
    setEditing(true);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate(inviteEmail);
  };

  const updateField =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const addressLine = [
    org.address_street,
    [org.address_postal_code, org.address_city].filter(Boolean).join(" "),
    org.address_country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Shell>
      <Link
        to="/organizations"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {t("organizations.detail.back")}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-foreground">{org.name}</h1>
            <Badge
              variant={
                org.status === "approved"
                  ? "default"
                  : org.status === "pending"
                    ? "secondary"
                    : "destructive"
              }
            >
              {t(`organizations.status.${org.status}`)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`organizations.type.${org.type}`)}
          </p>
        </div>
        {canManage && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            {t("organizations.detail.edit")}
          </Button>
        )}
      </div>

      {org.status === "rejected" && org.rejection_reason && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <strong>{t("organizations.detail.rejection_reason")}:</strong>{" "}
          {org.rejection_reason}
        </p>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <section className="space-y-4 rounded-md border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">{t("organizations.detail.basic")}</h2>
            <div className="space-y-2">
              <Label htmlFor="name">{t("organizations.form.name")}</Label>
              <Input
                id="name"
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={updateField("name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">{t("organizations.form.description")}</Label>
              <Textarea
                id="desc"
                rows={4}
                maxLength={2000}
                value={form.description}
                onChange={updateField("description")}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-card p-4">
            <div>
              <h2 className="text-lg font-semibold">{t("organizations.detail.address.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("organizations.detail.address.optional")}</p>
            </div>
            <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
              {t("organizations.detail.address.benefit")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_street">{t("address.street")}</Label>
                <Input id="address_street" maxLength={200} value={form.address_street} onChange={updateField("address_street")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_postal_code">{t("address.postal_code")}</Label>
                <Input id="address_postal_code" maxLength={20} value={form.address_postal_code} onChange={updateField("address_postal_code")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_city">{t("address.city")}</Label>
                <Input id="address_city" maxLength={120} value={form.address_city} onChange={updateField("address_city")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_country">{t("address.country")}</Label>
                <Input id="address_country" maxLength={120} value={form.address_country} onChange={updateField("address_country")} />
              </div>
            </div>
          </section>

          <div className="flex gap-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              {t("organizations.detail.save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {org.description && (
            <p className="mt-6 whitespace-pre-wrap text-sm text-foreground">
              {org.description}
            </p>
          )}
          {addressLine && (
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>{t("organizations.detail.address.title")}:</strong> {addressLine}
            </p>
          )}
        </>
      )}



      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">
          {t("organizations.members.title")}
        </h2>
        <ul className="mt-3 space-y-2">
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
                    {t(`organizations.members.${m.role === "owner" ? "owner" : "member"}`)}
                  </p>
                </div>
                {canManage && m.role !== "owner" && (
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
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground">
            {t("organizations.members.pending_invitations")}
          </h2>

          <form onSubmit={handleInvite} className="mt-3 flex gap-2">
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
          </form>

          {invitations.length > 0 && (
            <ul className="mt-4 space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("organizations.members.expires")}:{" "}
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(t("organizations.members.cancel_invitation_confirm"))) {
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12">{children}</main>
    </div>
  );
}
