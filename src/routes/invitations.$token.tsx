import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  acceptInvitation,
  declineInvitation,
  getInvitationByToken,
} from "@/lib/invitations.functions";

export const Route = createFileRoute("/invitations/$token")({
  component: InvitationAcceptPage,
});

function InvitationAcceptPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const fetchInvitation = useServerFn(getInvitationByToken);
  const acceptFn = useServerFn(acceptInvitation);
  const declineFn = useServerFn(declineInvitation);

  const invQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvitation({ data: { token } }),
  });

  const [done, setDone] = useState<null | "accepted" | "declined">(null);

  const acceptMutation = useMutation({
    mutationFn: () => acceptFn({ data: { token } }),
    onSuccess: (r) => {
      setDone("accepted");
      toast.success(t("invitations.accepted"));
      navigate({ to: "/organizations/$orgId", params: { orgId: r.organizationId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineFn({ data: { token } }),
    onSuccess: () => {
      setDone("declined");
      toast.success(t("invitations.declined"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inv = invQuery.data?.invitation;
  const orgName = inv?.organization?.name ?? "";

  const returnTo = `/invitations/${token}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("invitations.title")}
        </h1>
        {invQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !inv ? (
          <p className="mt-4 text-sm text-destructive">{t("invitations.not_found")}</p>
        ) : inv.status !== "pending" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("invitations.already_processed")}
          </p>
        ) : new Date(inv.expires_at) < new Date() ? (
          <p className="mt-4 text-sm text-destructive">{t("invitations.expired")}</p>
        ) : (
          <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
            <p className="text-foreground">
              {t("invitations.description", { org: orgName || "—" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("invitations.for_email", { email: inv.email })}
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : !user ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("invitations.need_login")}
                </p>
                <div className="flex gap-2">
                  <Link to="/login">
                    <Button>{t("auth.login")}</Button>
                  </Link>
                  <Link to="/register">
                    <Button variant="outline">{t("auth.register")}</Button>
                  </Link>
                </div>
              </div>
            ) : user.email?.toLowerCase().trim() !== inv.email.toLowerCase().trim() ? (
              <p className="text-sm text-destructive">
                {t("invitations.email_mismatch", { expected: inv.email, current: user.email })}
              </p>
            ) : done ? (
              <p className="text-sm text-muted-foreground">
                {done === "accepted" ? t("invitations.accepted") : t("invitations.declined")}
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  {t("invitations.accept")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => declineMutation.mutate()}
                  disabled={declineMutation.isPending}
                >
                  {t("invitations.decline")}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
