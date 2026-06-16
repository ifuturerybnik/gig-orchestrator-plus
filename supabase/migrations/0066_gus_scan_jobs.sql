-- Zlecenia masowego skanowania GUS REGON (BIR1.1) z aktualizacją Bazy PP.
-- Joby przetwarzane są asynchronicznie przez worker /api/public/gus-scan-tick.

create table if not exists public.gus_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  identifier text not null check (identifier in ('nip','regon','krs')),
  fields text[] not null,
  entity_ids uuid[] not null,
  status text not null default 'queued' check (status in ('queued','running','done','cancelled','error')),
  total int not null default 0,
  processed int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0,
  current_entity_id uuid,
  last_error text,
  changes jsonb not null default '[]'::jsonb,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists gus_scan_jobs_user_idx on public.gus_scan_jobs (created_by, created_at desc);
create index if not exists gus_scan_jobs_status_idx on public.gus_scan_jobs (status) where status in ('queued','running');

grant select, insert, update on public.gus_scan_jobs to authenticated;
grant all on public.gus_scan_jobs to service_role;

alter table public.gus_scan_jobs enable row level security;

drop policy if exists "gus_scan_jobs read own" on public.gus_scan_jobs;
create policy "gus_scan_jobs read own"
  on public.gus_scan_jobs for select to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "gus_scan_jobs insert own" on public.gus_scan_jobs;
create policy "gus_scan_jobs insert own"
  on public.gus_scan_jobs for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "gus_scan_jobs update own" on public.gus_scan_jobs;
create policy "gus_scan_jobs update own"
  on public.gus_scan_jobs for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- Opcjonalnie: harmonogram cron (uruchom ręcznie po podmianie sekretu).
-- ALTER DATABASE postgres SET app.cron_secret = '<wartość CRON_SECRET>';
-- select cron.schedule(
--   'gus-scan-tick',
--   '* * * * *',
--   $$ select net.http_post(
--        url := 'https://concertivo.eu/api/public/gus-scan-tick',
--        headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret', true)),
--        body := '{}'::jsonb
--      ) $$
-- );
