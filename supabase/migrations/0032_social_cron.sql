-- 0032_social_cron.sql
-- pg_cron joby dla Social Media:
--   * social-publish-scheduled — co minutę (publikacja zaplanowanych postów)
--   * social-sync-metrics      — co godzinę (synchronizacja metryk)
--   * social-sync-inbox        — co 15 minut (synchronizacja komentarzy)
--
-- WYMAGANIA:
--   1. W Supabase Vault musi istnieć 'autokor_cron_secret' (TA SAMA wartość co
--      CRON_SECRET w Lovable Secrets) — patrz 0020_autokor_cron.sql.
--   2. W Supabase Vault musi istnieć 'autokor_app_url' (URL aplikacji bez slasha).
--
-- Idempotentne — można odpalać wielokrotnie.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Usuń stare joby (jeśli istnieją)
do $$
declare
  v_jobid bigint;
  v_names text[] := array['social-publish-scheduled', 'social-sync-metrics', 'social-sync-inbox'];
  v_name text;
begin
  foreach v_name in array v_names loop
    select jobid into v_jobid from cron.job where jobname = v_name;
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
  end loop;
end$$;

-- Job 1: publikacja zaplanowanych postów (co minutę)
select cron.schedule(
  'social-publish-scheduled',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_app_url')
             || '/api/public/social-publish-scheduled',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'X-Cron-Secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);

-- Job 2: synchronizacja metryk (co godzinę, o pełnej godzinie)
select cron.schedule(
  'social-sync-metrics',
  '0 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_app_url')
             || '/api/public/social-sync-metrics',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'X-Cron-Secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

-- Job 3: synchronizacja inboxa / komentarzy (co 15 minut)
select cron.schedule(
  'social-sync-inbox',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_app_url')
             || '/api/public/social-sync-inbox',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'X-Cron-Secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

-- DIAGNOSTYKA:
--   select jobname, schedule, active from cron.job order by jobname;
--   select * from cron.job_run_details
--     where jobid in (select jobid from cron.job where jobname like 'social-%')
--     order by start_time desc limit 30;
--   select id, status_code, content::text, created from net._http_response
--     order by id desc limit 20;
