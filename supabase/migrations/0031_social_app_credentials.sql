-- 0031_social_app_credentials.sql
-- Per-organizacja credentials aplikacji developerskiej dla każdej platformy SM.
-- Pozwala użytkownikom (nie-Lovable) skonfigurować integrację z poziomu aplikacji:
-- wklejają swój Client ID + Client Secret (uzyskany u dostawcy), my szyfrujemy
-- secret AES-256-GCM (helper: src/lib/crypto.server.ts, klucz: EXT_PII_ENCRYPTION_KEY).
-- Tokeny dostępu i konta podłączonych użytkowników żyją w social_accounts (0028).

create table if not exists public.social_app_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  client_id text not null,
  client_secret_enc text not null,
  extra jsonb not null default '{}'::jsonb,
  configured_by uuid not null references auth.users(id),
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform)
);

create index if not exists social_app_credentials_org_idx
  on public.social_app_credentials (organization_id);

grant select, insert, update, delete on public.social_app_credentials to authenticated;
grant all on public.social_app_credentials to service_role;

alter table public.social_app_credentials enable row level security;

drop policy if exists "social_app_credentials_select" on public.social_app_credentials;
create policy "social_app_credentials_select" on public.social_app_credentials for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_app_credentials_insert" on public.social_app_credentials;
create policy "social_app_credentials_insert" on public.social_app_credentials for insert to authenticated
  with check (configured_by = auth.uid()
    and (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid())));

drop policy if exists "social_app_credentials_update" on public.social_app_credentials;
create policy "social_app_credentials_update" on public.social_app_credentials for update to authenticated
  using (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_app_credentials_delete" on public.social_app_credentials;
create policy "social_app_credentials_delete" on public.social_app_credentials for delete to authenticated
  using (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
