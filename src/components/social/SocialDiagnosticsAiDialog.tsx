import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Download, Loader2, Send, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  askSocialDiagnosticsAi,
  getSocialDiagnosticsBundle,
} from "@/lib/social-diagnostics.functions";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function SocialDiagnosticsAiDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: t("social.diagnostics_ai.initial", {
        defaultValue:
          "Mam dostęp do bezpiecznego snapshotu Meta oraz kodu integracji wszystkich social mediów. Opisz błąd albo wklej komunikat z Meta, a wskażę najbardziej prawdopodobną przyczynę i pliki do poprawy.",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const askFn = useServerFn(askSocialDiagnosticsAi);
  const bundleFn = useServerFn(getSocialDiagnosticsBundle);

  const downloadBundle = async () => {
    setDownloading(true);
    try {
      const res = await bundleFn({ data: { organizationId: orgId } });
      const blob = new Blob([res.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("social.diagnostics_ai.downloaded", { defaultValue: "Pobrano plik diagnostyczny." }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await askFn({ data: { organizationId: orgId, messages: next.slice(-10) } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setMessages(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                {t("social.diagnostics_ai.title", { defaultValue: "AI diagnostyka integracji social media" })}
              </DialogTitle>
              <DialogDescription>
                {t("social.diagnostics_ai.subtitle", {
                  defaultValue:
                    "Czat korzysta z zewnętrznej integracji OpenAI i otrzymuje kontekst kodu social mediów bez tokenów ani sekretów.",
                })}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={downloadBundle} disabled={downloading}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t("social.diagnostics_ai.download", { defaultValue: "Pobierz kod" })}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          <div className="space-y-4 pr-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[82%]" : "mr-auto max-w-[88%]"}>
                <div className={m.role === "user" ? "rounded-md bg-primary px-4 py-3 text-primary-foreground" : "rounded-md border bg-muted/30 px-4 py-3"}>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("social.diagnostics_ai.thinking", { defaultValue: "Analizuję kod integracji…" })}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              maxLength={12000}
              placeholder={t("social.diagnostics_ai.placeholder", {
                defaultValue: "Np. dlaczego Instagram zwraca Authorization Error przy like albo brakuje instagram_manage_comments przy odpowiedzi?",
              })}
            />
            <Button className="self-end" onClick={send} disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("common.submit")}
            </Button>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {t("social.diagnostics_ai.safe_note", {
              defaultValue: "Eksport i czat maskują Client ID oraz nie przekazują tokenów, Client Secret ani kluczy runtime.",
            })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}