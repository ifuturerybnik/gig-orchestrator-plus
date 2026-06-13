// Concertivo — kompozycja maila. WYSIWYG + temat + odbiorcy + StopkaPicker + szablony.
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import { StopkaPicker } from "@/components/email/StopkaPicker";
import { sendEmail } from "@/lib/email-send.functions";
import { listSzablony } from "@/lib/email-szablony.functions";
import type { MailScope } from "./MailLayout";

interface Wiadomosc {
  id: string;
  od_email: string | null;
  temat: string;
  body_html: string | null;
  body_text: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: MailScope;
  skrzynkaId: string;
  replyTo?: Wiadomosc | null;
}

export function ComposeDialog({ open, onOpenChange, scope, skrzynkaId, replyTo }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sendFn = useServerFn(sendEmail);
  const listSzablonyFn = useServerFn(listSzablony);
  const orgId = scope.kind === "org" ? scope.orgId : null;

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [sending, setSending] = useState(false);
  const editorApiRef = useRef<{ insertText: (t: string) => void } | null>(null);

  const szablonyQ = useQuery({
    queryKey: ["szablony-compose", orgId ?? "user", open],
    enabled: open,
    queryFn: async () => {
      // Osobiste szablony zawsze; szablony org tylko jeśli mamy orgId.
      const userP = listSzablonyFn({ data: { scope: "user" } });
      const orgP = orgId
        ? listSzablonyFn({ data: { scope: "organization", organizationId: orgId } })
        : Promise.resolve({ szablony: [] as Array<{ id: string; nazwa: string; kategoria: string | null; temat: string; body_html: string }> });
      const [u, o] = await Promise.all([userP, orgP]);
      return [...(u.szablony ?? []), ...(o.szablony ?? [])];
    },
  });
  const szablony = szablonyQ.data ?? [];

  useEffect(() => {
    if (!open) return;
    if (replyTo) {
      setTo(replyTo.od_email ?? "");
      setSubject(replyTo.temat?.startsWith("Re:") ? replyTo.temat : `Re: ${replyTo.temat ?? ""}`);
      setBody("");
    } else {
      setTo("");
      setSubject("");
      setBody("");
    }
    setSignatureHtml("");
  }, [open, replyTo]);

  function applyTemplate(id: string) {
    const s = szablony.find((x) => x.id === id);
    if (!s) return;
    if (s.temat) setSubject(s.temat);
    setBody(s.body_html || "");
  }

  async function handleSend() {
    if (!to.trim()) {
      toast.error(t("correspondence.mail.composer.recipient_required"));
      return;
    }
    setSending(true);
    try {
      const recipients = to
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((email) => ({ email }));
      const fullBody = signatureHtml
        ? `${body}<br><br>${signatureHtml}`
        : body;
      await sendFn({
        data: {
          skrzynkaId,
          to: recipients,
          subject,
          bodyHtml: fullBody,
        },
      });
      toast.success(t("correspondence.mail.composer.sent"));
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["email_wiadomosci", skrzynkaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {replyTo ? t("correspondence.mail.composer.reply_title") : t("correspondence.mail.composer.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="grid gap-2">
            <Label>{t("correspondence.mail.composer.to")}</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="adres@przyklad.pl, drugi@przyklad.pl"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("correspondence.mail.composer.subject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          {szablony.length > 0 && (
            <div className="grid gap-2">
              <Label>{t("correspondence.mail.composer.template")}</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t("correspondence.mail.composer.pick_template")} />
                </SelectTrigger>
                <SelectContent>
                  {szablony.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nazwa}
                      {s.kategoria ? ` — ${s.kategoria}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>{t("correspondence.mail.composer.body")}</Label>
            <WysiwygEditor
              value={body}
              onChange={setBody}
              minHeight="300px"
              onReady={(api) => { editorApiRef.current = api; }}
            />
          </div>
          <StopkaPicker
            signatureHtml={signatureHtml}
            onSignatureHtmlChange={setSignatureHtml}
            orgId={orgId}
          />
          {signatureHtml && (
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">
                {t("correspondence.mail.composer.signature_preview", "Podgląd stopki")}
              </Label>
              <div
                className="rounded-md border bg-white p-4 overflow-x-auto"
                // Stopka jest zaufanym HTML-em renderowanym przez renderStopkaHtml
                // (StopkaPicker), nie pochodzi od użytkownika z zewnątrz.
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? t("common.loading") : t("correspondence.mail.composer.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
