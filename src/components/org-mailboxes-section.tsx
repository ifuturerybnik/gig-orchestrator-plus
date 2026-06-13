import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createSkrzynka,
  deleteSkrzynka,
  listSkrzynki,
  syncSkrzynka,
} from "@/lib/email-skrzynki.functions";
import { getOrganizationDetails } from "@/lib/organizations.functions";
import {
  MailConfigAiAssistant,
  applyMailSuggestion,
  type MailFormSuggestion,
} from "@/components/mail/MailConfigAiAssistant";
import { Trash2, RefreshCw, Plus } from "lucide-react";

type FormState = {
  nazwa: string;
  email: string;
  imap_host: string;
  imap_port: string;
  imap_login: string;
  imap_haslo: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_login: string;
  smtp_haslo: string;
  smtp_use_ssl: boolean;
};

const empty: FormState = {
  nazwa: "",
  email: "",
  imap_host: "",
  imap_port: "993",
  imap_login: "",
  imap_haslo: "",
  imap_use_ssl: true,
  smtp_host: "",
  smtp_port: "465",
  smtp_login: "",
  smtp_haslo: "",
  smtp_use_ssl: true,
};

export function OrgMailboxesSection({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchList = useServerFn(listSkrzynki);
  const createFn = useServerFn(createSkrzynka);
  const deleteFn = useServerFn(deleteSkrzynka);
  const syncFn = useServerFn(syncSkrzynka);
  const fetchDetails = useServerFn(getOrganizationDetails);

  const detailsQuery = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => fetchDetails({ data: { organizationId: orgId } }),
  });

  const queryKey = ["skrzynki", "org", orgId];
  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchList({ data: { scope: "organization", organizationId: orgId } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          nazwa: form.nazwa,
          typ: "wspolna",
          organizationId: orgId,
          email: form.email,
          imap_host: form.imap_host,
          imap_port: Number(form.imap_port),
          imap_login: form.imap_login,
          imap_haslo: form.imap_haslo,
          imap_use_ssl: form.imap_use_ssl,
          smtp_host: form.smtp_host,
          smtp_port: Number(form.smtp_port),
          smtp_login: form.smtp_login,
          smtp_haslo: form.smtp_haslo,
          smtp_use_ssl: form.smtp_use_ssl,
        },
      }),
    onSuccess: () => {
      toast.success(t("skrzynki.created"));
      setForm(empty);
      setOpen(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { skrzynkaId: id } }),
    onSuccess: () => {
      toast.success(t("skrzynki.deleted"));
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => syncFn({ data: { skrzynkaId: id } }),
    onSuccess: () => {
      toast.success(t("skrzynki.sync_started"));
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const isOwner = detailsQuery.data?.isOwner ?? false;
  const skrzynki = listQuery.data?.skrzynki ?? [];

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("skrzynki.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("skrzynki.subtitle")}
          </p>
        </div>
        {isOwner && !open && (
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("skrzynki.add")}
          </Button>
        )}
      </header>

      {open && isOwner && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border bg-background p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("skrzynki.form.nazwa")}>
              <Input
                required
                value={form.nazwa}
                onChange={(e) => setForm({ ...form, nazwa: e.target.value })}
                placeholder={t("skrzynki.form.nazwa_placeholder")}
              />
            </Field>
            <Field label={t("skrzynki.form.email")}>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>

          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">IMAP</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("skrzynki.form.host")}>
                <Input
                  required
                  value={form.imap_host}
                  onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                  placeholder="imap.example.com"
                />
              </Field>
              <Field label={t("skrzynki.form.port")}>
                <Input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={form.imap_port}
                  onChange={(e) => setForm({ ...form, imap_port: e.target.value })}
                />
              </Field>
              <Field label={t("skrzynki.form.login")}>
                <Input
                  required
                  value={form.imap_login}
                  onChange={(e) => setForm({ ...form, imap_login: e.target.value })}
                />
              </Field>
              <Field label={t("skrzynki.form.password")}>
                <Input
                  required
                  type="password"
                  value={form.imap_haslo}
                  onChange={(e) => setForm({ ...form, imap_haslo: e.target.value })}
                />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch
                checked={form.imap_use_ssl}
                onCheckedChange={(v) => setForm({ ...form, imap_use_ssl: v })}
              />
              {t("skrzynki.form.ssl")}
            </label>
          </fieldset>

          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">SMTP</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("skrzynki.form.host")}>
                <Input
                  required
                  value={form.smtp_host}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </Field>
              <Field label={t("skrzynki.form.port")}>
                <Input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={form.smtp_port}
                  onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
                />
              </Field>
              <Field label={t("skrzynki.form.login")}>
                <Input
                  required
                  value={form.smtp_login}
                  onChange={(e) => setForm({ ...form, smtp_login: e.target.value })}
                />
              </Field>
              <Field label={t("skrzynki.form.password")}>
                <Input
                  required
                  type="password"
                  value={form.smtp_haslo}
                  onChange={(e) => setForm({ ...form, smtp_haslo: e.target.value })}
                />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch
                checked={form.smtp_use_ssl}
                onCheckedChange={(v) => setForm({ ...form, smtp_use_ssl: v })}
              />
              {t("skrzynki.form.ssl")}
            </label>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setForm(empty);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {t("skrzynki.save")}
            </Button>
          </div>
        </form>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : skrzynki.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("skrzynki.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {skrzynki.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.nazwa}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.email} · IMAP {s.imap_host}:{s.imap_port} · SMTP{" "}
                  {s.smtp_host}:{s.smtp_port}
                </p>
                {s.last_sync_error && (
                  <p className="mt-1 text-xs text-destructive">
                    {s.last_sync_error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => syncMutation.mutate(s.id)}
                  disabled={syncMutation.isPending}
                  title={t("skrzynki.sync")}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {isOwner && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(t("skrzynki.delete_confirm"))) {
                        deleteMutation.mutate(s.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
