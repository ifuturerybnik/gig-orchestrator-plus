-- 0047_social_sync_controls.sql
-- Kontrola synchronizacji social — per-konto toggle + globalne ustawienia + historia ticków.
-- Wprowadza:
--   1) social_accounts: auto_sync_inbox, auto_ai_moderation, sync_paused_until
--   2) app_settings (key/value JSONB) — globalne parametry aplikacji (tylko admin może zapisywać)
--   3) social_sync_runs — audit każdego ticku crona (insert tylko service_role)

-- 1) social_accounts: nowe kolumny per-konto -------------------------------------------------
alter table public.social_accounts
  add column if not exists auto_sync_inbox boolean not null default true;
alter table public.social_accounts
  add column if not exists auto_ai_moderation boolean not null default false;
alter table public.social_accounts
  add column if not exists sync_paused_until timestamptz null;

create index if not exists social_accounts_auto_sync_idx
  on public.social_accounts (auto_sync_inbox)
  where auto_sync_inbox = true;

-- 2) app_settings — globalne klucze konfiguracyjne ------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

-- Każdy zalogowany może czytać (kolumny non-sekretne — limity), zapis tylko service_role
-- przez server fn z guardem requireAdmin.
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

-- Seed startowych wartości limitów social
insert into public.app_settings (key, value, description) values
  ('social.sync_inbox.max_posts', '200'::jsonb,
    'Maks. postów przetwarzanych w jednym ticku crona sync-inbox (across all orgs).'),
  ('social.sync_inbox.window_days', '30'::jsonb,
    'Okno czasowe (dni) — bierzemy pod uwagę tylko posty opublikowane w ostatnich N dniach.'),
  ('social.sync_metrics.max_posts', '200'::jsonb,
    'Maks. postów w ticku crona sync-metrics.'),
  ('social.sync_metrics.window_days', '30'::jsonb,
    'Okno czasowe (dni) dla synchronizacji metryk.'),
  ('social.import_posts.per_account_limit', '25'::jsonb,
    'Maks. postów pobieranych z jednego konta w ticku import-posts.'),
  ('social.import_posts.max_accounts', '500'::jsonb,
    'Maks. kont obsługiwanych w jednym ticku import-posts.'),
  ('social.ai_moderation.max_per_tick', '20'::jsonb,
    'Maks. komentarzy analizowanych przez AI w jednym ticku per konto.'),
  ('social.ai_moderation.daily_budget_calls', '1000'::jsonb,
    'Globalny dzienny limit wywołań AI moderacji komentarzy (chroni budżet OpenAI).')
on conflict (key) do nothing;

-- 3) social_sync_runs — historia / audit ticków ---------------------------------------------
create table if not exists public.social_sync_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('sync-inbox', 'sync-metrics', 'import-posts')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  processed integer not null default 0,
  inserted integer not null default 0,
  ok_count integer not null default 0,
  fail_count integer not null default 0,
  skipped_permission integer not null default 0,
  skipped_disabled integer not null default 0,
  skipped_budget integer not null default 0,
  ai_moderated integer not null default 0,
  error_summary jsonb,
  notes text
);

create index if not exists social_sync_runs_job_started_idx
  on public.social_sync_runs (job, started_at desc);

grant select on public.social_sync_runs to authenticated;
grant all on public.social_sync_runs to service_role;

alter table public.social_sync_runs enable row level security;

-- Czytać może tylko admin (super_admin / admin_staff). Insert wyłącznie service_role.
drop policy if exists social_sync_runs_admin_select on public.social_sync_runs;
create policy social_sync_runs_admin_select on public.social_sync_runs
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'admin_staff'::app_role)
  );
