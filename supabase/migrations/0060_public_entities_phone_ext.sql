-- Wydziel numer wewnętrzny telefonu z public_entities.phone do osobnej kolumny.
alter table public.public_entities
  add column if not exists phone_ext text;
