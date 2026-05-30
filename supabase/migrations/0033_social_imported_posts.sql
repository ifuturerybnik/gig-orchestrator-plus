-- 0033_social_imported_posts.sql
-- Wsparcie dla importu / synchronizacji postów opublikowanych POZA aplikacją
-- (bezpośrednio na Fanpage'u FB, w Instagramie itd.).
--
-- Zmiany:
--   1. Kolumna `source` w `social_posts` ('app' | 'imported') — pozwala odróżnić
--      posty utworzone w Concertivo od zaciągniętych z platformy.
--   2. Indeks na (platform, external_post_id) w `social_post_results` —
--      przyspiesza deduplikację przy imporcie.
--   3. Nowy cron job `social-import-posts` (co 30 min) — wywołuje endpoint
--      `/api/public/social-import-posts`, który pobiera świeże posty z
--      każdego podłączonego konta i zapisuje je w `social_posts`/`social_post_results`.
--
-- Wymaga, by w Vault istniały sekrety 'autokor_cron_secret' i 'autokor_app_url'
-- (patrz 0020_autokor_cron.sql i 0032_social_cron.sql).
--
-- Idempotentne — można odpalać wielokrotnie.

-- 1) Kolumna source
alter table public.social_posts
  add column if not exists source text not null default 'app';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'social_posts'
      and constraint_name = 'social_posts_source_chk'
  ) then
    alter table public.social_posts
      add constraint social_posts_source_chk
      check (source in ('app', 'imported'));
  end if;
end$$;

create index if not exists social_posts_org_source_idx
  on public.social_posts (organization_id, source);

-- 2) Szybkie szukanie po external_post_id przy dedupie importu
create index if not exists social_post_results_platform_extid_idx
  on public.social_post_results (platform, external_post_id)
  where external_post_id is not null;

-- 3) Cron: import postów z platform co 30 minut
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'social-import-posts';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'social-import-posts',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_app_url')
             || '/api/public/social-import-posts',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'X-Cron-Secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'autokor_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
