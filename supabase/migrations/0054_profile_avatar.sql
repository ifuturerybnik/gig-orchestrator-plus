-- Awatar profilu użytkownika. Data URL (base64, max ~128px) lub https URL.
-- Wykorzystywany w nagłówku aplikacji, komunikatorach itp.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text NULL;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'Awatar profilu użytkownika (data URL base64 lub https URL).';
