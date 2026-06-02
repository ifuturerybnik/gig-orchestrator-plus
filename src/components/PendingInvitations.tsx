import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptInvitation,
  declineInvitation,
  listMyPendingInvitations,
} from "@/lib/invitations.functions";

export function PendingInvitations() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyPendingInvitations);
  const acceptFn = useServerFn(acceptInvitation);
  const declineFn = useServerFn(declineInvitation);

  const q = useQuery({
    queryKey: ["my-pending-invitations"],
    queryFn: () => listFn(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["my-pending-invitations"] });

  const acceptMutation = useMutation({
    mutationFn: (token: string) => acceptFn({ data: { token } }),
    onSuccess: () => {
      toast.success(t("invitations.accepted"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMutation = useMutation({
    mutationFn: (token: string) => declineFn({ data: { token } }),
    onSuccess: () => {
      toast.success(t("invitations.declined"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invitations = q.data?.invitations ?? [];
  if (invitations.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">
        {t("invitations.pending_title")}
      </h2>
      <ul className="mt-3 space-y-3">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3"
          >
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {inv.organization?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("invitations.expires_at", {
                  date: new Date(inv.expires_at).toLocaleDateString(),
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => acceptMutation.mutate(inv.token)}
                disabled={acceptMutation.isPending}
              >
                {t("invitations.accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => declineMutation.mutate(inv.token)}
                disabled={declineMutation.isPending}
              >
                {t("invitations.decline")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
