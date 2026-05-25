-- 0012_encrypt_pii.sql
-- Szyfrowanie wrażliwych danych osobowych (PESEL, IBAN) na poziomie aplikacji.
--
-- Format zapisu w kolumnach *_enc:
--   base64( iv(12B) || authTag(16B) || ciphertext )
--   Algorytm: AES-256-GCM, klucz z EXT_PII_ENCRYPTION_KEY (32B w base64).
--
-- DB nie zna klucza — odszyfrowanie odbywa się WYŁĄCZNIE w server functions
-- (src/lib/crypto.server.ts). Nawet dump bazy / dostęp do panelu Supabase nie
-- pozwala odczytać tych pól.
--
-- UWAGA: jeśli zgubisz EXT_PII_ENCRYPTION_KEY, dane stają się nieodzyskiwalne.

-- Zmiana nazw kolumn — sygnalizuje, że trzymamy ciphertext, nie plaintext.
-- Idempotentnie: jeśli już przemianowane, nic nie robi.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'billing_pesel'
  ) then
    alter table public.profiles rename column billing_pesel to billing_pesel_enc;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'billing_bank_account'
  ) then
    alter table public.profiles rename column billing_bank_account to billing_bank_account_enc;
  end if;
end$$;

-- Zwiększamy limit długości — ciphertext jest dłuższy niż plaintext.
alter table public.profiles
  alter column billing_pesel_enc        type text,
  alter column billing_bank_account_enc type text;

comment on column public.profiles.billing_pesel_enc        is 'AES-256-GCM ciphertext (base64: iv|tag|ct). Decrypt only in server fn.';
comment on column public.profiles.billing_bank_account_enc is 'AES-256-GCM ciphertext (base64: iv|tag|ct). Decrypt only in server fn.';
