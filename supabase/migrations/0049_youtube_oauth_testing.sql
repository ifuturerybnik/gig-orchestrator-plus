-- 0049_youtube_oauth_testing.sql
-- Wspiera Model A integracji YouTube w trybie OAuth "Testing":
--  * flaga extra.youtube_oauth_testing = true w social_app_credentials
--    -> refresh_token wygasa po ~7 dniach (limit Google);
--       UI ostrzega, cron wysyła powiadomienie owner/admin.
--  * social_accounts.refresh_alert_sent_at -> anty-spam dla crona.

ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS refresh_alert_sent_at timestamptz NULL;

COMMENT ON COLUMN public.social_accounts.refresh_alert_sent_at IS
  'Ostatnie wysłane powiadomienie o zbliżającym sie/wygaslym refresh_token (anty-spam crona).';
