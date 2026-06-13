import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createSkrzynka,
  deleteSkrzynka,
  listSkrzynki,
  syncSkrzynka,
  updateSkrzynka,
} from "@/lib/email-skrzynki.functions";
import { Trash2, RefreshCw, Plus, Pencil } from "lucide-react";
import { MailboxForm, type MailboxFormState } from "@/components/mail/MailboxForm";

type SkrzynkaRow = {
  id: string;
  nazwa: string;
  nazwa_wyswietlana: string | null;
  ikona_url: string | null;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_login: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_login: string;
  smtp_use_ssl: boolean;
  last_sync_error: string | null;
};

function rowToForm(s: SkrzynkaRow): MailboxFormState {
  return {
    nazwa: s.nazwa,
    nazwa_wyswietlana: s.nazwa_wyswietlana ?? "",
    ikona_url: s.ikona_url ?? "",
    email: s.email,
    imap_host: s.imap_host,
    imap_port: String(s.imap_port ?? 993),
    imap_login: s.imap_login,
    imap_haslo: "",
    imap_use_ssl: !!s.imap_use_ssl,
    smtp_host: s.smtp_host,
    smtp_port: String(s.smtp_port ?? 465),
    smtp_login: s.smtp_login,
    smtp_haslo: "",
    smtp_use_ssl: !!s.smtp_use_ssl,
  };
}


export function MyMailboxesSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const fetchList = useServerFn(listSkrzynki);
  const createFn = useServerFn(createSkrzynka);
  const updateFn = useServerFn(updateSkrzynka);
  const deleteFn = useServerFn(deleteSkrzynka);
  const syncFn = useServerFn(syncSkrzynka);

  const queryKey = ["skrzynki", "mine"];
  const listQuery = useQuery({
    queryKey,
    queryFn: () => fetchList({ data: { scope: "mine" } }),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SkrzynkaRow | null>(null);

  const createMutation = useMutation({
    mutationFn: (form: MailboxFormState) =>
      createFn({
        data: {
          nazwa: form.nazwa,
          nazwa_wyswietlana: form.nazwa_wyswietlana || null,
          typ: "osobista",
          organizationId: null,
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
      setCreating(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: MailboxFormState }) =>
      updateFn({
        data: {
          skrzynkaId: id,
          nazwa: form.nazwa,
          nazwa_wyswietlana: form.nazwa_wyswietlana || null,
          email: form.email,
          imap_host: form.imap_host,
          imap_port: Number(form.imap_port),
          imap_login: form.imap_login,
          imap_haslo: form.imap_haslo || null,
          imap_use_ssl: form.imap_use_ssl,
          smtp_host: form.smtp_host,
          smtp_port: Number(form.smtp_port),
          smtp_login: form.smtp_login,
          smtp_haslo: form.smtp_haslo || null,
          smtp_use_ssl: form.smtp_use_ssl,
        },
      }),
    onSuccess: () => {
      toast.success(t("skrzynki.updated", "Skrzynka zaktualizowana"));
      setEditing(null);
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

  const skrzynki = (listQuery.data?.skrzynki ?? []) as SkrzynkaRow[];

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("skrzynki.my_title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("skrzynki.my_subtitle")}</p>
        </div>
        {!creating && !editing && (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> {t("skrzynki.add")}
          </Button>
        )}
      </header>

      {creating && (
        <MailboxForm
          mode="create"
          submitting={createMutation.isPending}
          onSubmit={(f) => createMutation.mutate(f)}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <MailboxForm
          mode="edit"
          initial={rowToForm(editing)}
          submitting={updateMutation.isPending}
          onSubmit={(f) => updateMutation.mutate({ id: editing.id, form: f })}
          onCancel={() => setEditing(null)}
        />
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
                  {s.nazwa_wyswietlana && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({t("skrzynki.from_label", "Od")}: {s.nazwa_wyswietlana})
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.email} · IMAP {s.imap_host}:{s.imap_port} · SMTP {s.smtp_host}:{s.smtp_port}
                </p>
                {s.last_sync_error && (
                  <p className="mt-1 text-xs text-destructive">{s.last_sync_error}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setEditing(s);
                  }}
                  title={t("common.edit", "Edytuj")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
