import { createFileRoute } from '@tanstack/react-router';
import { ContactsList } from '@/components/contacts/ContactsList';

export const Route = createFileRoute('/_authenticated/contacts/me')({
  component: MyContactsPage,
});

function MyContactsPage() {
  return <ContactsList scope={{ kind: 'user' }} />;
}
