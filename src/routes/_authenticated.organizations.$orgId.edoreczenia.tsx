import { createFileRoute } from "@tanstack/react-router";
import EdoreczeniaInbox from "@/components/edoreczenia/EdoreczeniaInbox";

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
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">e-Doręczenia</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Skrzynka e-Doręczeń organizacji. Konfiguracja w profilu organizacji.
      </p>
      <div className="mt-6">
        <EdoreczeniaInbox scope={{ kind: "org", orgId }} setupHref={`/organizations/${orgId}/profile`} />
      </div>
    </div>
  );
}
