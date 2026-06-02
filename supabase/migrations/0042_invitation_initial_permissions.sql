alter type public.invitation_status add value if not exists 'declined';

alter table public.organization_invitations
  add column if not exists initial_is_org_admin boolean not null default false,
  add column if not exists initial_modules jsonb not null default '["events","budget","contacts","counterparties","mail","autokorespondencja","ai_studio","social","web","dysk"]'::jsonb,
  add column if not exists initial_budget_mode text not null default 'full'
    check (initial_budget_mode in ('full','unrealized_only'));

create index if not exists organization_invitations_initial_modules_gin_idx
  on public.organization_invitations using gin (initial_modules);
