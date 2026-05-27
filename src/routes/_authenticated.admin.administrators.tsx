import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyProfile } from "@/lib/profile.functions";
import {
  listAdministrators,
  setAdministratorRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/administrators")({
  component: AdministratorsPage,
});

function AdministratorsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchList = useServerFn(listAdministrators);
  const setRole = useServerFn(setAdministratorRole);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const isSuperAdmin = profileQuery.data?.isSuperAdmin === true;

  const listQuery = useQuery({
    queryKey: ["administrators"],
    queryFn: () => fetchList(),
    enabled: isSuperAdmin,
  });

  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<"super_admin" | "admin_staff">("admin_staff");

  const grant = useMutation({
    mutationFn: () => setRole({ data: { email, role, action: "grant" } }),
    onSuccess: () => {
      toast.success(t("admin.administrators.granted"));
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["administrators"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revoke = useMutation({
    mutationFn: (input: { email: string; role: "super_admin" | "admin_staff" }) =>
      setRole({ data: { ...input, action: "revoke" } }),
    onSuccess: () => {
      toast.success(t("admin.administrators.revoked"));
      queryClient.invalidateQueries({ queryKey: ["administrators"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!profileQuery.isLoading && !isSuperAdmin) {
    return <Navigate to="/admin/approvals" />;
  }

  const items = listQuery.data?.administrators ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        {t("admin.administrators.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("admin.administrators.subtitle")}
      </p>

      <section className="mt-6 rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-medium">
          {t("admin.administrators.grant_title")}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <div className="space-y-1">
            <Label htmlFor="adm-email">
              {t("admin.administrators.email")}
            </Label>
            <Input
              id="adm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("admin.administrators.role")}</Label>
            <Select value={role} onValueChange={(v) => setRoleValue(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin_staff">
                  {t("admin.administrators.role_admin_staff")}
                </SelectItem>
                <SelectItem value="super_admin">
                  {t("admin.administrators.role_super_admin")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => grant.mutate()}
              disabled={!email || grant.isPending}
            >
              {t("admin.administrators.grant_btn")}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium">
          {t("admin.administrators.list_title")}
        </h2>
        {listQuery.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("admin.administrators.empty")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((a) => (
              <li
                key={a.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {[a.first_name, a.last_name].filter(Boolean).join(" ") ||
                      t("admin.administrators.no_name")}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.roles.map((r) => (
                      <span
                        key={r}
                        className={
                          r === "super_admin"
                            ? "rounded bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase text-primary"
                            : "rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                        }
                      >
                        {t(`admin.administrators.role_${r}`)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {a.roles.map((r) =>
                    a.email ? (
                      <Button
                        key={r}
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          revoke.mutate({
                            email: a.email!,
                            role: r as "super_admin" | "admin_staff",
                          })
                        }
                        disabled={revoke.isPending}
                      >
                        {t("admin.administrators.revoke_btn", {
                          role: t(`admin.administrators.role_${r}`),
                        })}
                      </Button>
                    ) : null,
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
