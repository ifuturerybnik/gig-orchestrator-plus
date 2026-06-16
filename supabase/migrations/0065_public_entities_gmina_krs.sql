-- Dodaje kolumny "gmina" i "krs" do public_entities.
alter table public.public_entities
  add column if not exists gmina text,
  add column if not exists krs text;

create index if not exists public_entities_gmina_idx on public.public_entities (gmina);
create index if not exists public_entities_krs_idx on public.public_entities (krs);
