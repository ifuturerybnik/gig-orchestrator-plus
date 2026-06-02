-- 0041_invitation_notifications.sql
-- Powiadomienia użytkownika (m.in. o zaproszeniach do organizacji).

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;

alter table public.user_notifications enable row level security;

drop policy if exists "notifications_select_own" on public.user_notifications;
create policy "notifications_select_own" on public.user_notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.user_notifications;
create policy "notifications_update_own" on public.user_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.user_notifications;
create policy "notifications_delete_own" on public.user_notifications
  for delete to authenticated using (user_id = auth.uid());

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc) where read_at is null;

create index if not exists user_notifications_user_kind_idx
  on public.user_notifications (user_id, kind);

create index if not exists organization_invitations_email_status_idx
  on public.organization_invitations (lower(email), status);
