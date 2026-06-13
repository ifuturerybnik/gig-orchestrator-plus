// Strona globalnej korespondencji osobistej (poza organizacjami).
// Zakładki: Poczta e-mail (MailLayout w trybie 'user') + Komunikatory (placeholder).
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Mail, MessageCircle } from "lucide-react";
import { Header } from "@/components/header";
import { MailLayout } from "@/components/mail/MailLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/correspondence")({
  component: CorrespondencePage,
});

type Tab = "mail" | "messengers";

function CorrespondencePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("mail");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("correspondence.personal_title", "Korespondencja osobista")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "correspondence.personal_subtitle",
            "Twoja prywatna korespondencja — niezależna od organizacji.",
          )}
        </p>

        <div className="mt-4 inline-flex rounded-md border border-border bg-card p-1">
          <TabButton active={tab === "mail"} onClick={() => setTab("mail")}>
            <Mail className="h-4 w-4 mr-2" />
            {t("correspondence.tabs.mail", "Poczta e-mail")}
          </TabButton>
          <TabButton active={tab === "messengers"} onClick={() => setTab("messengers")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {t("correspondence.tabs.messengers", "Komunikatory")}
          </TabButton>
        </div>

        <div className="mt-6">
          {tab === "mail" ? (
            <MailLayout scope={{ kind: "user" }} />
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              {t(
                "correspondence.messengers_placeholder",
                "Integracje z komunikatorami (Messenger, WhatsApp, Signal, Telegram) pojawią się tutaj wkrótce.",
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-3 py-1.5 text-sm rounded transition",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
