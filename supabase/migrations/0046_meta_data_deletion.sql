-- 0046_meta_data_deletion.sql
-- Tabela do śledzenia żądań usunięcia danych z Meta (Facebook/Instagram).
-- Wymagana przez Meta App Review: musimy mieć publiczny endpoint
-- "Data Deletion Callback URL", który Meta wywołuje gdy użytkownik usuwa
-- aplikację z poziomu FB/IG i żąda usunięcia swoich danych.
--
-- Endpoint: POST /api/public/meta-data-deletion
-- Strona statusu: GET /data-deletion/<confirmation_code>

create table if not exists public.meta_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  fb_user_id text not null,
  app_id text,
  signed_request_raw text,
  status text not null default 'received', -- 'received' | 'processed' | 'failed'
  affected_accounts int not null default 0,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists meta_ddr_fb_user_idx
  on public.meta_data_deletion_requests (fb_user_id);
create index if not exists meta_ddr_received_idx
  on public.meta_data_deletion_requests (received_at desc);

grant select on public.meta_data_deletion_requests to anon, authenticated;
grant all on public.meta_data_deletion_requests to service_role;

alter table public.meta_data_deletion_requests enable row level security;

-- Strona statusu jest publiczna; wiersz znajdujemy po unikalnym confirmation_code
-- (UUID, nieodgadywalnym), więc SELECT dla anon jest bezpieczny.
drop policy if exists "meta_ddr_select_public" on public.meta_data_deletion_requests;
create policy "meta_ddr_select_public" on public.meta_data_deletion_requests
  for select to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
