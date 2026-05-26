import { createFileRoute } from '@tanstack/react-router';
import { ContactsList } from '@/components/contacts/ContactsList';

export const Route = createFileRoute('/_authenticated/contacts/org/$orgId')({
  component: OrgContactsPage,
});

function OrgContactsPage() {
  const { orgId } = Route.useParams();
  return <ContactsList scope={{ kind: 'org', organizationId: orgId }} />;
}
