import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import IntegracjaEdoreczeniaTab from "@/components/settings/IntegracjaEdoreczeniaTab";
import EdoreczeniaInboxTab from "@/components/settings/EdoreczeniaInboxTab";
import EdoreczeniaSetup from "@/components/edoreczenia/EdoreczeniaSetup";
import { Inbox, PlugZap, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/edoreczenia")({
  head: () => ({
    meta: [
      { title: "e-Doręczenia — Concertivo" },
      { name: "description", content: "Obsługa skrzynki e-Doręczeń oraz integracja z ADE." },
    ],
  }),
  component: EdoreczeniaAdminPage,
});

type Tab = "inbox" | "setup" | "legacy";

function EdoreczeniaAdminPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">e-Doręczenia</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Skrzynka systemowa e-Doręczeń oraz konfiguracja integracji z ADE.
      </p>

      <div className="mt-4 inline-flex rounded-md border border-border bg-card p-1">
        <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
          <Inbox className="mr-2 h-4 w-4" />
          e-Doręczenia
        </TabButton>
        <TabButton active={tab === "setup"} onClick={() => setTab("setup")}>
          <Settings2 className="mr-2 h-4 w-4" />
          Skrzynki systemowe
        </TabButton>
        <TabButton active={tab === "legacy"} onClick={() => setTab("legacy")}>
          <PlugZap className="mr-2 h-4 w-4" />
          Integracja (env)
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === "inbox" && <EdoreczeniaInboxTab />}
        {tab === "setup" && <EdoreczeniaSetup scope={{ kind: "system" }} />}
        {tab === "legacy" && <IntegracjaEdoreczeniaTab />}
      </div>
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
