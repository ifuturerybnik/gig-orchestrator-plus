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

// Helper do nakładania sugestii AI na FormState skrzynki — zwraca nowy obiekt.
// Zostawia puste pola formularza nienaruszone, gdy AI nic nie podpowiedziało.
export function applyMailSuggestion<
  T extends {
    nazwa: string;
    email: string;
    imap_host: string;
    imap_port: string;
    imap_login: string;
    imap_use_ssl: boolean;
    smtp_host: string;
    smtp_port: string;
    smtp_login: string;
    smtp_use_ssl: boolean;
  },
>(prev: T, s: MailFormSuggestion): T {
  const next: T = { ...prev };
  if (s.nazwa) next.nazwa = s.nazwa;
  if (s.email) next.email = s.email;
  if (s.imap_host) next.imap_host = s.imap_host;
  if (s.imap_port !== undefined && s.imap_port !== null && s.imap_port !== "")
    next.imap_port = String(s.imap_port);
  if (s.imap_login) next.imap_login = s.imap_login;
  if (typeof s.imap_use_ssl === "boolean") next.imap_use_ssl = s.imap_use_ssl;
  if (s.smtp_host) next.smtp_host = s.smtp_host;
  if (s.smtp_port !== undefined && s.smtp_port !== null && s.smtp_port !== "")
    next.smtp_port = String(s.smtp_port);
  if (s.smtp_login) next.smtp_login = s.smtp_login;
  if (typeof s.smtp_use_ssl === "boolean") next.smtp_use_ssl = s.smtp_use_ssl;
  return next;
}

type Props = {
  currentEmail?: string;
  onApply: (s: MailFormSuggestion) => void;
};

const SYSTEM_PROMPT_PL = `Jesteś asystentem konfiguracji skrzynki e-mail w aplikacji Concertivo.
Twoim celem jest WYPEŁNIĆ formularz za użytkownika zadając MINIMUM pytań — najlepiej tylko o adres e-mail i (jeśli niejasne) dostawcę.

Pola formularza: nazwa (etykieta wewnętrzna), nazwa_wyswietlana (Od — nazwa nadawcy widoczna u odbiorcy, np. „Jan Kowalski - Concertivo"), email, imap_host, imap_port (domyślnie 993), imap_login (zwykle = email), imap_use_ssl (domyślnie true), smtp_host, smtp_port (domyślnie 465 SSL), smtp_login (zwykle = email), smtp_use_ssl (domyślnie true). Awatar skrzynki (ikona) jest wgrywany przez użytkownika jako plik — NIE proponuj go w suggestion; jeśli ktoś o niego zapyta, wyjaśnij, że jest widoczny tylko w Concertivo, a awatar widoczny u adresatów w ich poczcie konfiguruje się po stronie serwera pocztowego (Gravatar po adresie e-mail lub BIMI — rekord DNS + logo SVG).

ZASADY:
1. NIGDY nie pytaj o hasło ani go nie sugeruj.
2. NIE pytaj o SSL/porty — przyjmuj standardy znanych dostawców. Pytania techniczne (porty, STARTTLS, alternatywne hosty) zadawaj TYLKO jeśli użytkownik wyraźnie napisze, że poprzednia próba zapisu/połączenia nie zadziałała.
3. Gdy znasz adres e-mail i dostawcę — od razu wypełnij CAŁY obiekt suggestion (wszystkie 9 pól + nazwa). Login = pełny adres e-mail.
4. ZAWSZE dołączaj pole "email" w suggestion, jeśli użytkownik je podał — nawet jeśli pytasz tylko o dostawcę.
5. Pole "nazwa" możesz zaproponować z imienia lub części adresu (np. "kamilla@lzy.pl" → "Kamilla").
6. Jeśli dostawca nieoczywisty z domeny — zadaj JEDNO krótkie pytanie z listą popularnych (Gmail, Outlook/Office365, iCloud, Yahoo, Hostinger, OVH, home.pl, nazwa.pl, własny serwer…). Dla Gmail/Outlook z 2FA krótko wspomnij o haśle aplikacji.

ZNANE DOSTAWCY (IMAP / SMTP, oba 993/465 SSL chyba że zaznaczono):
- Gmail: imap.gmail.com / smtp.gmail.com
- Outlook/Office365/Hotmail/Live: outlook.office365.com / smtp.office365.com — SMTP 587 STARTTLS (smtp_port=587, smtp_use_ssl=false)
- iCloud: imap.mail.me.com / smtp.mail.me.com — SMTP 587 STARTTLS
- Yahoo: imap.mail.yahoo.com / smtp.mail.yahoo.com
- Hostinger: imap.hostinger.com / smtp.hostinger.com
- OVH: ssl0.ovh.net / ssl0.ovh.net
- home.pl: imap.home.pl / smtp.home.pl
- nazwa.pl: imap.nazwa.pl / smtp.nazwa.pl
- Zoho: imap.zoho.eu / smtp.zoho.eu (lub .com)

ZAWSZE odpowiadaj w formacie JSON: {"reply": "krótka odpowiedź po polsku", "suggestion": { ...pola do wypełnienia... } }.
Pomiń "suggestion" tylko gdy naprawdę nie masz nic do zaproponowania.`;

const SYSTEM_PROMPT_EN = `You are an email mailbox configuration assistant in the Concertivo app.
Goal: FILL the form with the FEWEST questions — ideally only email + provider (if not obvious).

Fields: nazwa, email, imap_host, imap_port (default 993), imap_login (usually = email), imap_use_ssl (default true), smtp_host, smtp_port (default 465 SSL), smtp_login, smtp_use_ssl (default true).

RULES:
1. NEVER ask for the password.
2. DO NOT ask about SSL/ports — assume standards. Ask technical details ONLY if the user reports the previous attempt failed.
3. Once you know email + provider, fill the WHOLE suggestion object at once. Login = full email.
4. ALWAYS include "email" in suggestion when the user gave it.
5. You may propose "nazwa" from the local-part or first name.
6. If provider unclear from the domain, ask ONE short question listing common providers. Mention app password for Gmail/Outlook with 2FA.

Known providers (IMAP / SMTP, 993/465 SSL unless noted): Gmail (imap.gmail.com / smtp.gmail.com), Outlook/Office365 (outlook.office365.com / smtp.office365.com, SMTP 587 STARTTLS, smtp_use_ssl=false), iCloud (imap.mail.me.com / smtp.mail.me.com 587 STARTTLS), Yahoo (imap.mail.yahoo.com / smtp.mail.yahoo.com), Hostinger (imap.hostinger.com / smtp.hostinger.com), OVH (ssl0.ovh.net / ssl0.ovh.net), home.pl (imap.home.pl / smtp.home.pl), nazwa.pl (imap.nazwa.pl / smtp.nazwa.pl), Zoho (imap.zoho.{eu|com} / smtp.zoho.{eu|com}).

ALWAYS reply as JSON: {"reply": "short answer", "suggestion": { ...fields... } }.`;

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

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
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
        <Button
          type="button"
          size="sm"
          disabled={loading || !input.trim()}
          className="gap-1"
          onClick={() => void send()}
        >
          <Send className="h-3.5 w-3.5" />
          {t("mail_ai.send", "Wyślij")}
        </Button>
      </div>
    </div>
  );
}
