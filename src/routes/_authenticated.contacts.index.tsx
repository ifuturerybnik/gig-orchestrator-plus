import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/contacts/')({
  beforeLoad: () => { throw redirect({ to: '/contacts/me' }); },
});
