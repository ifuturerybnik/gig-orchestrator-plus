-- 0044_org_pending_deletion.sql
-- Miękkie usuwanie organizacji z 7-dniowym okresem karencji.
-- Owner inicjuje usunięcie → wszyscy członkowie dostają powiadomienie i w ciągu
-- 7 dni można je anulować. Endpoint cron /api/public/org-deletion-tick.ts
-- usuwa organizacje po upływie deletion_scheduled_for.

alter table public.organizations
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users(id);

create index if not exists organizations_pending_deletion_idx
  on public.organizations (deletion_scheduled_for)
  where deletion_scheduled_for is not null;
