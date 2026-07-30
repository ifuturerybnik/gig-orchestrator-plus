import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Megaphone } from "lucide-react";
import EdoreczeniaInbox from "@/components/edoreczenia/EdoreczeniaInbox";
import EdoreczeniaBulk from "@/components/edoreczenia/EdoreczeniaBulk";
import { getOrgBulkAccess } from "@/lib/edoreczenia-bulk.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/edoreczenia")({
  head: () => ({
    meta: [
      { title: "e-Doręczenia organizacji — Concertivo" },
      { name: "description", content: "Skrzynka e-Doręczeń organizacji." },
    ],
  }),
  component: OrgEdoreczeniaPage,
});

function OrgEdoreczeniaPage() {
  const { orgId } = Route.useParams();
  const [tab, setTab] = useState<"inbox" | "bulk">("inbox");

  const fetchAccess = useServerFn(getOrgBulkAccess);
  const accessQuery = useQuery({
    queryKey: ["edoreczenia-bulk-access", orgId],
    queryFn: () => fetchAccess({ data: { organizationId: orgId } }),
  });
  const hasBulk = accessQuery.data?.hasAccess ?? false;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">e-Doręczenia</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Skrzynka e-Doręczeń organizacji. Konfiguracja w profilu organizacji.
      </p>

      {hasBulk && (
        <div className="mt-4 inline-flex flex-wrap rounded-md border border-border bg-card p-1">
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
            <Inbox className="mr-2 h-4 w-4" />
            e-Doręczenia
          </TabButton>
          <TabButton active={tab === "bulk"} onClick={() => setTab("bulk")}>
            <Megaphone className="mr-2 h-4 w-4" />
            e-Doręczenia zbiorowe
          </TabButton>
        </div>
      )}

      <div className="mt-6">
        {hasBulk && tab === "bulk" ? (
          <EdoreczeniaBulk orgId={orgId} />
        ) : (
          <EdoreczeniaInbox
            scope={{ kind: "org", orgId }}
            setupHref={`/organizations/${orgId}/profile`}
          />
        )}
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
