-- 0028_social_integrations.sql — Moduł "Integracje SM"
-- Tabele: social_accounts, social_posts, social_post_results, social_post_metrics, social_oauth_states.
-- Tokeny dostępowe szyfrowane AES-256-GCM w server fn (kolumny *_enc).
-- Klucz EXT_PII_ENCRYPTION_KEY (helpery w src/lib/crypto.server.ts).

-- 1) social_accounts
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  external_account_id text not null,
  account_name text not null,
  account_avatar_url text,
  scopes text[] not null default '{}',
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  status text not null default 'connected',
  last_error text,
  connected_by uuid not null references auth.users(id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform)
);

create index if not exists social_accounts_org_idx on public.social_accounts (organization_id);

grant select, insert, update, delete on public.social_accounts to authenticated;
grant all on public.social_accounts to service_role;

alter table public.social_accounts enable row level security;

drop policy if exists "social_accounts_select" on public.social_accounts;
create policy "social_accounts_select" on public.social_accounts for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_accounts_insert" on public.social_accounts;
create policy "social_accounts_insert" on public.social_accounts for insert to authenticated
  with check (connected_by = auth.uid() and (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid())));

drop policy if exists "social_accounts_update" on public.social_accounts;
create policy "social_accounts_update" on public.social_accounts for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_accounts_delete" on public.social_accounts;
create policy "social_accounts_delete" on public.social_accounts for delete to authenticated
  using (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

-- 2) social_posts
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  target_platforms text[] not null default '{}',
  content_per_platform jsonb not null default '{}'::jsonb,
  linked_event_id uuid references public.performances(id) on delete set null,
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  ai_generated boolean not null default false,
  ai_scenariusz text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_org_status_idx on public.social_posts (organization_id, status);
create index if not exists social_posts_org_scheduled_idx on public.social_posts (organization_id, scheduled_at);
create index if not exists social_posts_event_idx on public.social_posts (linked_event_id);

grant select, insert, update, delete on public.social_posts to authenticated;
grant all on public.social_posts to service_role;

alter table public.social_posts enable row level security;

drop policy if exists "social_posts_select" on public.social_posts;
create policy "social_posts_select" on public.social_posts for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_posts_insert" on public.social_posts;
create policy "social_posts_insert" on public.social_posts for insert to authenticated
  with check (created_by = auth.uid() and (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid())));

drop policy if exists "social_posts_update" on public.social_posts;
create policy "social_posts_update" on public.social_posts for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_posts_delete" on public.social_posts;
create policy "social_posts_delete" on public.social_posts for delete to authenticated
  using (created_by = auth.uid() or public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

-- 3) social_post_results
create table if not exists public.social_post_results (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform text not null,
  status text not null,
  external_post_id text,
  external_url text,
  error_message text,
  published_at timestamptz not null default now(),
  unique (post_id, platform)
);

create index if not exists social_post_results_post_idx on public.social_post_results (post_id);

grant select, insert, update, delete on public.social_post_results to authenticated;
grant all on public.social_post_results to service_role;

alter table public.social_post_results enable row level security;

drop policy if exists "social_post_results_select" on public.social_post_results;
create policy "social_post_results_select" on public.social_post_results for select to authenticated
  using (exists (
    select 1 from public.social_posts p
    where p.id = social_post_results.post_id
      and (public.is_member_of(auth.uid(), p.organization_id) or public.is_admin(auth.uid()))
  ));

-- 4) social_post_metrics
create table if not exists public.social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform text not null,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  views integer not null default 0,
  reach integer not null default 0,
  engagement_rate numeric(6,4),
  snapshot_at timestamptz not null default now()
);

create index if not exists social_post_metrics_post_idx on public.social_post_metrics (post_id, snapshot_at desc);

grant select, insert, update, delete on public.social_post_metrics to authenticated;
grant all on public.social_post_metrics to service_role;

alter table public.social_post_metrics enable row level security;

drop policy if exists "social_post_metrics_select" on public.social_post_metrics;
create policy "social_post_metrics_select" on public.social_post_metrics for select to authenticated
  using (exists (
    select 1 from public.social_posts p
    where p.id = social_post_metrics.post_id
      and (public.is_member_of(auth.uid(), p.organization_id) or public.is_admin(auth.uid()))
  ));

-- 5) social_oauth_states (CSRF, 15 min)
create table if not exists public.social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  platform text not null,
  redirect_back text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists social_oauth_states_expires_idx on public.social_oauth_states (expires_at);

grant select, insert, delete on public.social_oauth_states to authenticated;
grant all on public.social_oauth_states to service_role;

alter table public.social_oauth_states enable row level security;

drop policy if exists "social_oauth_states_self" on public.social_oauth_states;
create policy "social_oauth_states_self" on public.social_oauth_states for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "social_oauth_states_insert" on public.social_oauth_states;
create policy "social_oauth_states_insert" on public.social_oauth_states for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "social_oauth_states_delete" on public.social_oauth_states;
create policy "social_oauth_states_delete" on public.social_oauth_states for delete to authenticated
  using (user_id = auth.uid());

-- 6) Dodaj scenariusze AI do ai_konfiguracja (jeśli istnieje)
do $$
begin
  if exists (select 1 from public.ai_konfiguracja where id = 1) then
    update public.ai_konfiguracja
       set scenariusz_model = coalesce(scenariusz_model, '{}'::jsonb)
         || jsonb_build_object(
              'social_post_from_event', coalesce(scenariusz_model->>'social_post_from_event', default_model),
              'social_post_from_prompt', coalesce(scenariusz_model->>'social_post_from_prompt', default_model),
              'social_post_adapt_platforms', coalesce(scenariusz_model->>'social_post_adapt_platforms', default_model),
              'social_best_time', coalesce(scenariusz_model->>'social_best_time', default_model),
              'social_engagement_analysis', coalesce(scenariusz_model->>'social_engagement_analysis', default_model)
            ),
           updated_at = now()
     where id = 1;
  end if;
end $$;

notify pgrst, 'reload schema';
