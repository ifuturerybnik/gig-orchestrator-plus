-- ON CONFLICT (teryt_code) wymaga zwykłego unique index/constraint, nie częściowego.
-- Postgres UNIQUE i tak pozwala na wiele NULL-i, więc partial index jest zbędny.
drop index if exists public.public_entities_teryt_unique;

create unique index if not exists public_entities_teryt_unique
  on public.public_entities (teryt_code);
