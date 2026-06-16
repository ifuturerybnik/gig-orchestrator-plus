import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { User as UserIcon, Building2 } from 'lucide-react';
import { Header } from '@/components/header';
import { listMyOrganizations } from '@/lib/organizations.functions';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/contacts')({
  component: ContactsLayout,
});

function ContactsLayout() {
  const { t } = useTranslation();
  const fetchOrgs = useServerFn(listMyOrganizations);
  const { data } = useQuery({
    queryKey: ['my-organizations'],
    queryFn: () => fetchOrgs(),
  });
  const location = useLocation();
  const orgs = (data?.organizations ?? []).filter(o => o.status === 'approved');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex w-full">
        <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-56 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-sidebar px-3 py-6">
          <ScopeLink to="/contacts/me" active={location.pathname.startsWith('/contacts/me')}>
            <UserIcon className="h-4 w-4" />
            {t('contacts.scope.user')}
          </ScopeLink>
          {orgs.length > 0 && (
            <div className="mt-4">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('contacts.scope.org')}
              </p>
              {orgs.map(o => {
                const href = `/contacts/org/${o.id}`;
                return (
                  <ScopeLink key={o.id} to={href} active={location.pathname === href}>
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{o.name}</span>
                  </ScopeLink>
                );
              })}
            </div>
          )}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold text-foreground">{t('contacts.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('contacts.subtitle')}</p>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ScopeLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
