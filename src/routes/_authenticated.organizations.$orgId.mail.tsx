import { createFileRoute } from "@tanstack/react-router";
import { MailLayout } from "@/components/mail/MailLayout";

export const Route = createFileRoute("/_authenticated/organizations/$orgId/mail")({
  component: OrgMailPage,
});

function OrgMailPage() {
  const { orgId } = Route.useParams();
  return <MailLayout scope={{ kind: "org", orgId }} />;
}
