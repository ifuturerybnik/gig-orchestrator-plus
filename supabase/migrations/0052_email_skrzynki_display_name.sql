-- Nazwa wyświetlana nadawcy (From: "Nazwa" <adres@…>) dla skrzynki e-mail.
-- "nazwa" pozostaje wewnętrzną etykietą widoczną tylko w aplikacji.
ALTER TABLE public.email_skrzynki
  ADD COLUMN IF NOT EXISTS nazwa_wyswietlana text;

COMMENT ON COLUMN public.email_skrzynki.nazwa_wyswietlana IS
  'Nazwa wyświetlana w nagłówku From: maila wychodzącego. NULL = wyślij tylko adres.';
