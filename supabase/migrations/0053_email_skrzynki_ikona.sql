-- Awatar/ikona skrzynki e-mail (data URL base64 lub https URL).
-- Ikona widoczna TYLKO W APLIKACJI — nie wpływa na to, jak adresaci widzą
-- nadawcę w swojej skrzynce (do tego służy Gravatar / BIMI po stronie serwera).

ALTER TABLE public.email_skrzynki
  ADD COLUMN IF NOT EXISTS ikona_url text NULL;

COMMENT ON COLUMN public.email_skrzynki.ikona_url IS
  'Awatar skrzynki widoczny tylko w Concertivo (data URL base64 lub https URL).';
