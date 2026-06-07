-- 0050_assistant.sql
-- Asystent Concertivo — czat AI per organizacja z RAG (dokumentacja + kod),
-- narzędziami read-only do danych org i twardym dziedziczeniem uprawnień usera.

-- =========================================================================
-- 0) Wymagane rozszerzenia
-- =========================================================================
create extension if not exists vector;

-- =========================================================================
-- 1) Wątki rozmów
-- =========================================================================
create table if not exists public.ai_assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'Nowa rozmowa',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_assistant_threads_user_org_updated_idx
  on public.ai_assistant_threads(user_id, org_id, updated_at desc);

-- =========================================================================
-- 2) Wiadomości
-- =========================================================================
create table if not exists public.ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_assistant_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  tool_calls jsonb,
  tool_call_id text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_assistant_messages_thread_created_idx
  on public.ai_assistant_messages(thread_id, created_at);

-- =========================================================================
-- 3) Baza wiedzy (RAG) — dokumentacja + kod
-- =========================================================================
create table if not exists public.ai_kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('doc','code')),
  source_path text not null,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_kb_chunks_embedding_idx
  on public.ai_kb_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists ai_kb_chunks_source_path_idx
  on public.ai_kb_chunks(source_path);

-- =========================================================================
-- 4) Metadane indeksacji
-- =========================================================================
create table if not exists public.ai_kb_index_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  docs_indexed int not null default 0,
  code_files_indexed int not null default 0,
  chunks_total int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  status text not null default 'running' check (status in ('running','ok','error')),
  error text
);

create index if not exists ai_kb_index_runs_started_idx
  on public.ai_kb_index_runs(started_at desc);

-- =========================================================================
-- 5) Rate limit per user (okno godzinowe)
-- =========================================================================
create table if not exists public.ai_assistant_rate_limits (
  user_id uuid not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_start)
);

create index if not exists ai_assistant_rate_limits_window_idx
  on public.ai_assistant_rate_limits(window_start);

-- =========================================================================
-- 6) Rozszerzenie organizations
-- =========================================================================
alter table public.organizations
  add column if not exists assistant_monthly_limit_usd numeric(10,2) not null default 5.00,
  add column if not exists assistant_enabled boolean not null default true;

-- =========================================================================
-- 7) Rozszerzenie ai_uzycie
-- =========================================================================
alter table public.ai_uzycie
  add column if not exists thread_id uuid,
  add column if not exists org_id uuid;

create index if not exists ai_uzycie_org_created_idx
  on public.ai_uzycie(org_id, created_at desc);
create index if not exists ai_uzycie_thread_idx
  on public.ai_uzycie(thread_id);

-- =========================================================================
-- GRANTS
-- =========================================================================
grant select, insert, update, delete on public.ai_assistant_threads to authenticated;
grant select, insert, update, delete on public.ai_assistant_messages to authenticated;
grant select on public.ai_kb_chunks to authenticated;
grant select on public.ai_kb_index_runs to authenticated;

grant all on public.ai_assistant_threads to service_role;
grant all on public.ai_assistant_messages to service_role;
grant all on public.ai_kb_chunks to service_role;
grant all on public.ai_kb_index_runs to service_role;
grant all on public.ai_assistant_rate_limits to service_role;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.ai_assistant_threads enable row level security;
alter table public.ai_assistant_messages enable row level security;
alter table public.ai_kb_chunks enable row level security;
alter table public.ai_kb_index_runs enable row level security;
alter table public.ai_assistant_rate_limits enable row level security;

drop policy if exists threads_owner on public.ai_assistant_threads;
create policy threads_owner on public.ai_assistant_threads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists messages_thread_owner on public.ai_assistant_messages;
create policy messages_thread_owner on public.ai_assistant_messages
  for all to authenticated
  using (exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.ai_assistant_threads t
    where t.id = thread_id and t.user_id = auth.uid()
  ));

drop policy if exists kb_read on public.ai_kb_chunks;
create policy kb_read on public.ai_kb_chunks
  for select to authenticated using (true);

drop policy if exists kb_runs_read on public.ai_kb_index_runs;
create policy kb_runs_read on public.ai_kb_index_runs
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================================
-- 8) RPC: wyszukiwanie semantyczne
-- =========================================================================
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  source_types text[] default array['doc','code'],
  match_count int default 8
)
returns table (
  id uuid,
  source_type text,
  source_path text,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.source_type,
    c.source_path,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.ai_kb_chunks c
  where c.source_type = any(source_types)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_kb_chunks(vector, text[], int) to authenticated, service_role;

-- =========================================================================
-- 9) Trigger aktualizujący updated_at na wątku
-- =========================================================================
create or replace function public.touch_assistant_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_assistant_threads
     set updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_assistant_thread on public.ai_assistant_messages;
create trigger trg_touch_assistant_thread
  after insert on public.ai_assistant_messages
  for each row execute function public.touch_assistant_thread();
