// Concertivo — manager szablonów email (organization scope).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import {
  listSzablony,
  upsertSzablon,
  deleteSzablon,
} from "@/lib/email-szablony.functions";
import { TEMPLATE_VARIABLES } from "@/lib/email-template-vars";
import type { MailScope } from "./MailLayout";

interface Props {
  scope: MailScope;
  onBack: () => void;
}

interface Szablon {
  id: string;
  nazwa: string;
  kategoria: string | null;
  temat: string;
  body_html: string;
}

export function SzablonyManager({ scope, onBack }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listSzablony);
  const upsertFn = useServerFn(upsertSzablon);
  const deleteFn = useServerFn(deleteSzablon);
  const isOrg = scope.kind === "org";
  const orgId = isOrg ? scope.orgId : null;
  const qKey = isOrg ? ["szablony-org", orgId] : ["szablony-user"];

  const q = useQuery({
    queryKey: qKey,
    queryFn: () =>
      isOrg
        ? listFn({ data: { scope: "organization", organizationId: orgId! } })
        : listFn({ data: { scope: "user" } }),
  });
  const szablony = (q.data?.szablony ?? []) as unknown as Szablon[];

  const [editing, setEditing] = useState<Szablon | null>(null);
  const [open, setOpen] = useState(false);
  const [nazwa, setNazwa] = useState("");
  const [kategoria, setKategoria] = useState("");
  const [temat, setTemat] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const editorRef = useState<{ insertText: (t: string) => void } | null>(null);

  function openNew() {
    setEditing(null);
    setNazwa("");
    setKategoria("");
    setTemat("");
    setBodyHtml("");
    setOpen(true);
  }
  function openEdit(s: Szablon) {
    setEditing(s);
    setNazwa(s.nazwa);
    setKategoria(s.kategoria ?? "");
    setTemat(s.temat);
    setBodyHtml(s.body_html);
    setOpen(true);
  }

  async function handleSave() {
    if (!nazwa.trim()) {
      toast.error(t("correspondence.templates.name_required"));
      return;
    }
    try {
      await upsertFn({
        data: {
          id: editing?.id,
          scope: isOrg ? "organization" : "user",
          organizationId: isOrg ? orgId! : null,
          nazwa: nazwa.trim(),
          kategoria: kategoria.trim() || null,
          temat,
          body_html: bodyHtml,
        },
      });
      toast.success(t("common.saved"));
      setOpen(false);
      qc.invalidateQueries({ queryKey: qKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function handleDelete(s: Szablon) {
    if (!confirm(t("correspondence.templates.delete_confirm"))) return;
    try {
      await deleteFn({ data: { id: s.id } });
      qc.invalidateQueries({ queryKey: qKey });
      toast.success(t("common.deleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("common.back")}
        </Button>
        <h1 className="text-2xl font-semibold flex-1">
          {t("correspondence.templates.title")}
        </h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          {t("correspondence.templates.new")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("correspondence.templates.subtitle")}
      </p>

      {q.isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
      {szablony.length === 0 && !q.isLoading && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t("correspondence.templates.empty")}
        </div>
      )}
      <div className="grid gap-2">
        {szablony.map((s) => (
          <Card key={s.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{s.nazwa}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.kategoria ? `${s.kategoria} • ` : ""}{s.temat || "—"}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(s)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("correspondence.templates.edit") : t("correspondence.templates.new")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-y-auto">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-1">
                <Label>{t("correspondence.templates.name")}</Label>
                <Input value={nazwa} onChange={(e) => setNazwa(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label>{t("correspondence.templates.category")}</Label>
                <Input value={kategoria} onChange={(e) => setKategoria(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1">
              <Label>{t("correspondence.templates.subject")}</Label>
              <Input value={temat} onChange={(e) => setTemat(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>{t("correspondence.templates.body")}</Label>
              <WysiwygEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                minHeight="280px"
                onReady={(api) => { editorRef[1](api); }}
              />
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                {t("correspondence.templates.variables")}
              </div>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                    onClick={() => {
                      const api = editorRef[0];
                      if (api) api.insertText(v.token);
                      else setBodyHtml((b) => b + v.token);
                    }}
                  >
                    {v.label} <code className="text-muted-foreground">{v.token}</code>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
