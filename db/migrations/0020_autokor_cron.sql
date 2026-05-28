-- 0020_autokor_cron.sql
-- pg_cron job wywołujący endpoint /api/public/autokor-tick co minutę.
--
-- WYMAGANIA:
--  1. W Lovable secrets musi istnieć CRON_SECRET (już dodany).
--  2. Ta sama wartość CRON_SECRET musi być wpisana w Supabase Vault
--     pod nazwą 'autokor_cron_secret' — patrz blok niżej.
--  3. URL aplikacji wpisany w Vault pod nazwą 'autokor_app_url'
--     (bez końcowego slasha, np. https://project--05f60994-abd0-41bb-8ffc-0df818beb304.lovable.app
--      do testów na preview, albo https://app.concertivo.eu po wdrożeniu na prod).
--
-- Idempotentne — można odpalać wielokrotnie.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================================
-- KROK 1 (RĘCZNIE w SQL Editor — wpisz SWOJE wartości i odpal RAZ):
-- ============================================================================
-- select vault.create_secret('WKLEJ_TU_CRON_SECRET',          'autokor_cron_secret');
-- select vault.create_secret('https://project--05f60994-abd0-41bb-8ffc-0df818beb304.lovable.app', 'autokor_app_url');
--
-- Jeśli sekrety już istnieją i chcesz je podmienić:
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'autokor_cron_secret'),
--   'NOWY_CRON_SECRET'
-- );
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'autokor_app_url'),
--   'https://nowy-url.lovable.app'
-- );
-- ============================================================================

-- KROK 2: harmonogram — najpierw usuń stary job (jeśli był), potem zaplanuj nowy.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'autokor-tick';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'autokor-tick',
  '* * * * *',  -- co minutę
  $$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_app_url') || '/api/public/autokor-tick',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'X-Cron-Secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_cron_secret')
      ),
      body        := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);

-- ============================================================================
-- DIAGNOSTYKA (odpalaj ręcznie):
--
-- Sprawdź czy job jest aktywny:
--   select * from cron.job where jobname = 'autokor-tick';
--
-- Ostatnie 20 uruchomień (status, czas, błąd):
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'autokor-tick')
--     order by start_time desc limit 20;
--
-- Ostatnie odpowiedzi HTTP z pg_net (200 = OK, 401 = zły sekret, 500 = błąd appki):
--   select id, status_code, content::text, created
--     from net._http_response
--     order by id desc limit 10;
--
-- Wyłącz job tymczasowo (np. na czas debugowania):
--   select cron.unschedule((select jobid from cron.job where jobname = 'autokor-tick'));
-- ============================================================================
