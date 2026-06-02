-- 0035_storage_r2_central_creds.sql
-- Pozwala adminowi wpisać poświadczenia centralnego Cloudflare R2 z UI
-- (zamiast wymuszać sekrety EXT_R2_* w runtime). Klucze zapisane są jako
-- zaszyfrowane AES-256-GCM (kolumny *_enc), pozostałe pola jawnym tekstem.
-- Backend ma fallback do EXT_R2_* gdy w DB pusto.

ALTER TABLE public.storage_global_config
  ADD COLUMN IF NOT EXISTS r2_account_id            text,
  ADD COLUMN IF NOT EXISTS r2_access_key_id_enc     text,
  ADD COLUMN IF NOT EXISTS r2_secret_access_key_enc text,
  ADD COLUMN IF NOT EXISTS r2_bucket                text,
  ADD COLUMN IF NOT EXISTS r2_public_base_url       text;
