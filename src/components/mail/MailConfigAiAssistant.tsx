// Asystent AI pomagający w konfiguracji skrzynki e-mail (IMAP/SMTP).
// Używany w MyMailboxesSection i OrgMailboxesSection (jeden mechanizm — zob.
// mem://features/unified-mail-mechanism).
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callAi } from "@/lib/ai.functions";

export type MailFormSuggestion = {
  nazwa?: string;
  email?: string;
  imap_host?: string;
  imap_port?: string | number;
  imap_login?: string;
  imap_use_ssl?: boolean;
  smtp_host?: string;
  smtp_port?: string | number;
  smtp_login?: string;
  smtp_use_ssl?: boolean;
};

type Msg = { role: "user" | "assistant"; text: string; suggestion?: MailFormSuggestion };

type Props = {
  currentEmail?: string;
  onApply: (s: MailFormSuggestion) => void;
};

const SYSTEM_PROMPT_PL = `Jesteś asystentem konfiguracji skrzynki e-mail w aplikacji Concertivo.
Pomagasz użytkownikowi wypełnić formularz z polami:
- nazwa (etykieta wewnętrzna),
- email (adres),
- imap_host, imap_port (np. 993), imap_login, imap_use_ssl (bool),
- smtp_host, smtp_port (np. 465 dla SSL / 587 dla STARTTLS), smtp_login, smtp_use_ssl (bool).
Hasło użytkownik wpisze sam (nigdy go nie pytaj ani nie sugeruj).
Zadawaj proste pytania (jeden temat na raz): jaki dostawca poczty (np. Gmail, Outlook/Office365, iCloud, Yahoo, OVH, home.pl, nazwa.pl, własny serwer itd.), jaki adres e-mail, czy włączone jest 2FA (Gmail/Outlook wymagają hasła aplikacji — wyjaśnij to krótko).
Kiedy znasz host/port/login dla danego dostawcy — wypełnij pole "suggestion" obiektem z polami, które potrafisz uzupełnić. Login dla większości dostawców to pełny adres e-mail.
ZAWSZE odpowiadaj w formacie JSON: {"reply": "krótka odpowiedź po polsku", "suggestion": { ...opcjonalne pola... } }.
Jeśli nie masz jeszcze co zasugerować — pomiń pole "suggestion" lub zostaw {}.`;

const SYSTEM_PROMPT_EN = `You are an email mailbox configuration assistant in the Concertivo app.
Help the user fill the form with fields:
- nazwa (internal label),
- email,
- imap_host, imap_port (e.g. 993), imap_login, imap_use_ssl (bool),
- smtp_host, smtp_port (e.g. 465 for SSL / 587 for STARTTLS), smtp_login, smtp_use_ssl (bool).
NEVER ask for or suggest a password — the user enters it themselves.
Ask simple, focused questions (one at a time): which provider (Gmail, Outlook/Office365, iCloud, Yahoo, OVH, home.pl, nazwa.pl, custom server…), what is the address, is 2FA on (Gmail/Outlook require an app password — explain briefly).
When you know host/port/login for a provider, fill the "suggestion" object. Login is usually the full email address.
ALWAYS reply as JSON: {"reply": "short answer", "suggestion": { ...optional fields... } }.
Skip "suggestion" if nothing to fill yet.`;

export function MailConfigAiAssistant({ currentEmail, onApply }: Props) {
  const { t, i18n } = useTranslation();
  const aiFn = useServerFn(callAi);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lang = i18n.language?.startsWith("en") ? "en" : "pl";
  const systemPrompt = lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_PL;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...(currentEmail
          ? [
              {
                role: "system" as const,
                content: `Aktualny adres w formularzu: ${currentEmail}`,
              },
            ]
          : []),
        ...next.map((m) => ({
          role: m.role,
          content: m.text,
        })),
      ];
      const res = await aiFn({
        data: {
          scenariusz: "mail_config_help",
          messages,
          max_tokens: 600,
          response_format: { type: "json_object" },
        },
      });
      const raw = (res as { content?: string }).content ?? "";
      let reply = raw;
      let suggestion: MailFormSuggestion | undefined;
      try {
        const cleaned = raw.replace(/```(?:json)?|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as {
          reply?: string;
          suggestion?: MailFormSuggestion;
        };
        reply = parsed.reply ?? raw;
        if (parsed.suggestion && Object.keys(parsed.suggestion).length > 0) {
          suggestion = parsed.suggestion;
        }
      } catch {
        // fallback — pokaż surową odpowiedź
      }
      setMsgs([...next, { role: "assistant", text: reply, suggestion }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {t("mail_ai.open", "Pomóż mi skonfigurować (AI)")}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("mail_ai.title", "Asystent konfiguracji poczty")}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("common.close", "Zamknij")}
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-background p-2"
      >
        {msgs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t(
              "mail_ai.intro",
              "Napisz np.: „Mam pocztę na Gmailu, adres jan@gmail.com" +
                "" +
                "” — zaproponuję ustawienia IMAP/SMTP. Hasła nigdy nie pytam.",
            )}
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "mr-6 rounded-md border border-border bg-card px-3 py-2 text-sm"
            }
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.suggestion && (
              <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {Object.entries(m.suggestion).map(([k, v]) => (
                    <li key={k}>
                      <span className="font-mono">{k}</span>: {String(v)}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => {
                    onApply(m.suggestion!);
                    toast.success(
                      t("mail_ai.applied", "Sugestia zastosowana w formularzu"),
                    );
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {t("mail_ai.apply", "Wypełnij pola")}
                </Button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("mail_ai.thinking", "Myślę…")}
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={t(
            "mail_ai.placeholder",
            "Opisz swojego dostawcę poczty (np. Gmail, Outlook, OVH…)",
          )}
          className="min-h-[44px] flex-1 resize-none text-sm"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()} className="gap-1">
          <Send className="h-3.5 w-3.5" />
          {t("mail_ai.send", "Wyślij")}
        </Button>
      </form>
    </div>
  );
}
