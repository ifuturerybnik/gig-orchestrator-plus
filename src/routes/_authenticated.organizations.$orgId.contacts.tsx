import { createFileRoute } from '@tanstack/react-router';
import { ContactsList } from '@/components/contacts/ContactsList';

export const Route = createFileRoute('/_authenticated/organizations/$orgId/contacts')({
  component: OrgContactsTab,
});

function OrgContactsTab() {
  const { orgId } = Route.useParams();
  return <ContactsList scope={{ kind: 'org', organizationId: orgId }} />;
}
