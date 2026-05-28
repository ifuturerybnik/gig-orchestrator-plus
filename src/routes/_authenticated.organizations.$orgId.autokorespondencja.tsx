import { createFileRoute } from "@tanstack/react-router";
import { AutokorespondencjaList } from "@/components/autokorespondencja/AutokorespondencjaList";

export const Route = createFileRoute(
  "/_authenticated/organizations/$orgId/autokorespondencja",
)({
  component: OrgAutokorPage,
});

function OrgAutokorPage() {
  const { orgId } = Route.useParams();
  return <AutokorespondencjaList orgId={orgId} />;
}
