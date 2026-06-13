-- ============================================================================
-- Concertivo — migracja 0055: automatyczne usuwanie wiadomości ze Spamu po 30 dniach
-- ============================================================================
-- Codzienny job pg_cron usuwa z bazy wiadomości w folderze 'Spam' starsze niż
-- 30 dni (na podstawie data_otrzymania). Plik IDEMPOTENTNY.
-- Wykonać ręcznie w SQL Editor zewnętrznego Supabase.
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.email_cleanup_old_spam()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.email_wiadomosci
  where folder = 'Spam'
    and coalesce(data_otrzymania, created_at) < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'email-spam-cleanup';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'email-spam-cleanup',
  '15 3 * * *',
  $$ select public.email_cleanup_old_spam(); $$
);
