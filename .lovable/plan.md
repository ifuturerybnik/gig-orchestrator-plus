
# Asystent Concertivo — plan implementacji

Czat AI dostępny w każdej organizacji, oparty o systemowy `OPENAI_API_KEY` Concertivo. Trzy warstwy wiedzy (dokumentacja, kod, dane org). Uprawnienia agenta = uprawnienia usera 1:1.

## 1. Założenia bezpieczeństwa (twarde)

- **Klucz OpenAI**: tylko systemowy `OPENAI_API_KEY` Concertivo. Userzy nie podpinają własnych.
- **Koszty**: każde wywołanie loguje się do `ai_uzycie` z `scenariusz='assistant'` + nowymi kolumnami `org_id`, `thread_id`.
- **Limity**: miesięczny budżet per org (`organizations.assistant_monthly_limit_usd`, domyślnie 5 USD). Rate-limit per user (30 msg/h).
- **Uprawnienia per moduł**: agent dziedziczy uprawnienia usera. Trzy warstwy obrony:
  1. Lista toolsów wysyłana do modelu jest **dynamicznie filtrowana** po `effectivePermissions(userId, orgId)` z `org-modules.ts`
  2. Każdy tool re-waliduje uprawnienie w handlerze — przy braku zwraca `{ error: "Brak dostępu do modułu X" }` (model zobaczy i odpowie userowi)
  3. RLS Supabase — trzecia warstwa, nawet w razie błędu logiki baza nie zwróci wierszy spoza scope'u
- **Dostęp do kodu** (warstwa 2 RAG):
  - Wszyscy: agent ROZUMIE kod (embeddingi pomagają w lepszych odpowiedziach), ale w system promptcie ma instrukcję NIE cytować kodu
  - Superadmin Concertivo (`has_role(uid, 'super_admin')`): instrukcja zmienia się na „możesz cytować kod gdy to pomaga"
  - Post-filter na serwerze: jeśli user nie jest superadminem, wycinamy z odpowiedzi bloki ` ```ts/tsx/js/sql `
- **PII**: w toolach maskujemy PESEL/IBAN (`***1234`), telefony i maile zostawiamy (są w UI), ale w system promptcie zakaz wysyłania ich poza Concertivo
- **Brak write actions w MVP** — tylko read-only tools

## 2. Migracja DB (`supabase/migrations/0050_assistant.sql`)

```sql
-- 1) Wątki rozmów
create table public.ai_assistant_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'Nowa rozmowa',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ai_assistant_threads(user_id, org_id, updated_at desc);

-- 2) Wiadomości
create table public.ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_assistant_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  tool_calls jsonb,           -- gdy assistant zażądał wywołań
  tool_call_id text,          -- gdy role='tool'
  tokens_in int default 0,
  tokens_out int default 0,
  cost_usd numeric(10,6) default 0,
  created_at timestamptz not null default now()
);
create index on public.ai_assistant_messages(thread_id, created_at);

-- 3) Baza wiedzy (RAG) — dokumentacja + kod
create extension if not exists vector;
create table public.ai_kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('doc','code')),
  source_path text not null,           -- np. 'docs/assistant/02-concerts.md' lub 'src/lib/email-send.functions.ts'
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,     -- text-embedding-3-small
  tokens int default 0,
  created_at timestamptz not null default now()
);
create index on public.ai_kb_chunks using hnsw (embedding vector_cosine_ops);
create index on public.ai_kb_chunks(source_path);

-- 4) Metadane indeksacji
create table public.ai_kb_index_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  docs_indexed int default 0,
  code_files_indexed int default 0,
  chunks_total int default 0,
  cost_usd numeric(10,6) default 0,
  status text not null default 'running',
  error text
);

-- 5) Rate limit per user
create table public.ai_assistant_rate_limits (
  user_id uuid not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_start)
);

-- 6) Rozszerzenie organizations o limit budżetu asystenta
alter table public.organizations
  add column if not exists assistant_monthly_limit_usd numeric(10,2) not null default 5.00,
  add column if not exists assistant_enabled boolean not null default true;

-- 7) Rozszerzenie ai_uzycie o thread_id (org_id jest opcjonalne, dodać jeśli nie ma)
alter table public.ai_uzycie
  add column if not exists thread_id uuid,
  add column if not exists org_id uuid;

-- GRANTS
grant select, insert, update, delete on public.ai_assistant_threads to authenticated;
grant select, insert, update, delete on public.ai_assistant_messages to authenticated;
grant select on public.ai_kb_chunks to authenticated;
grant select on public.ai_kb_index_runs to authenticated;
grant all on public.ai_assistant_threads to service_role;
grant all on public.ai_assistant_messages to service_role;
grant all on public.ai_kb_chunks to service_role;
grant all on public.ai_kb_index_runs to service_role;
grant all on public.ai_assistant_rate_limits to service_role;

-- RLS
alter table public.ai_assistant_threads enable row level security;
alter table public.ai_assistant_messages enable row level security;
alter table public.ai_kb_chunks enable row level security;
alter table public.ai_kb_index_runs enable row level security;

create policy threads_owner on public.ai_assistant_threads
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_thread_owner on public.ai_assistant_messages
  for all to authenticated
  using (exists (select 1 from public.ai_assistant_threads t where t.id = thread_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_assistant_threads t where t.id = thread_id and t.user_id = auth.uid()));

-- KB chunks: read-only dla zalogowanych (treści są ogólne — docs + kod opisany)
create policy kb_read on public.ai_kb_chunks for select to authenticated using (true);
create policy kb_runs_read on public.ai_kb_index_runs for select to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- Funkcja RPC do wyszukiwania semantycznego
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  source_types text[] default array['doc','code'],
  match_count int default 8
)
returns table (id uuid, source_type text, source_path text, content text, similarity float)
language sql stable as $$
  select c.id, c.source_type, c.source_path, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.ai_kb_chunks c
  where c.source_type = any(source_types)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
```

## 3. Dokumentacja asystenta (`docs/assistant/`)

Nowy katalog z plikami `.md` po polsku, opisującymi aplikację oczami usera (NIE developera):

```
docs/assistant/
  README.md           — instrukcja dla developera: kiedy aktualizować, jak reindeksować
  00-overview.md      — co to jest Concertivo, dla kogo, jakie typy organizacji
  01-modules.md       — przegląd wszystkich modułów + co który robi
  02-concerts.md      — moduł wydarzeń (statusy, dodawanie, edycja)
  03-budget.md        — moduł budżetu (kategorie, wydatki planowane vs zrealizowane)
  04-contacts.md      — kontakty (3 typy, hybryda user/org)
  05-counterparties.md — kontrahenci (współdzielona baza, claim)
  06-correspondence.md — Poczta + Autokorespondencja
  07-social.md        — Media społecznościowe
  08-web.md           — Strona WWW (news, gallery, embed)
  09-ai-studio.md     — AI Studio
  10-dysk.md          — Dysk plikowy
  11-members.md       — Członkowie i uprawnienia
  12-faq.md           — najczęstsze pytania userów
  99-changelog.md     — co kiedy zmienione w dokumentacji
```

## 4. Server fns i route'y

### `src/lib/assistant/permissions.server.ts`
- `getEffectivePermissionsForAssistant(userId, orgId)` — wrapper na istniejący helper z `org-modules`, zwraca `EffectiveOrgPermissions`
- `isSuperAdmin(userId)` — sprawdza `user_roles`

### `src/lib/assistant/tools.server.ts`
Definicje wszystkich toolsów z mapowaniem na wymagany moduł:

```ts
export const ASSISTANT_TOOLS = [
  { name: 'search_concerts', module: 'events', handler: searchConcerts, schema: {...} },
  { name: 'get_concert_details', module: 'events', handler: ..., schema: {...} },
  { name: 'search_contacts', module: 'contacts', ... },
  { name: 'get_contact', module: 'contacts', ... },
  { name: 'search_counterparties', module: 'counterparties', ... },
  { name: 'list_correspondence', module: 'mail', ... },
  { name: 'get_finance_summary', module: 'budget', ... },           // <-- przykład: bez budgeta nie ma toola
  { name: 'list_planned_expenses', module: 'budget', ... },
  { name: 'get_social_status', module: 'social', ... },
  { name: 'list_organization_members', module: null, ... },         // zawsze dostępne
  { name: 'search_knowledge_base', module: null, ... },             // RAG po dokumentacji
];

export function buildAvailableTools(perms: EffectiveOrgPermissions) {
  return ASSISTANT_TOOLS.filter(t => !t.module || hasModuleAccess(perms, t.module));
}
```

Każdy handler tools używa `supabaseAdmin` z explicit `eq('org_id', orgId)` + dodatkowy guard re-walidujący `hasModuleAccess` (nawet jeśli model wymyślił nazwę toola).

### `src/lib/assistant/rag.server.ts`
- `embedQuery(text)` → wektor 1536d przez OpenAI `text-embedding-3-small`
- `searchKb(query, sourceTypes, count)` → RPC `match_kb_chunks`

### `src/lib/assistant/indexer.server.ts`
- `indexDocs()` — czyta `docs/assistant/*.md`, chunkuje po ~800 znaków, embedduje, upsert do `ai_kb_chunks`
- `indexCode()` — czyta wybrane katalogi (`src/lib/`, `src/components/`, `src/routes/`), chunkuje pliki, embedduje
- `reindexAll()` — pełny przelot, log do `ai_kb_index_runs`

### `src/lib/assistant.functions.ts` (client-safe wrapper server fns)
- `listThreads(orgId)` — wątki usera w org
- `getThread(threadId)` — pojedynczy + wiadomości
- `createThread(orgId, firstMessage)` — tworzy + odpala generację
- `archiveThread(threadId)`
- `renameThread(threadId, title)`
- `deleteThread(threadId)`
- `reindexKnowledgeBase()` — tylko superadmin, uruchamia `reindexAll`
- `getKnowledgeBaseStatus()` — superadmin: ostatni run, liczba chunków, dni od reindeksacji

### `src/routes/api/public/assistant-stream.ts`
Server route SSE (POST). Walidacja bearer tokenem (manualnie, bo to public route ze streamingiem), pobiera `threadId` + `message`, robi cały flow:
1. `requireSupabaseAuth` — manualnie przez header
2. `checkRateLimit(userId)` — 30/h
3. `checkOrgBudget(orgId)` — suma `ai_uzycie` z miesiąca vs limit
4. Wczytaj historię wątku
5. Embedduj pytanie → `searchKb` → top 6 chunków jako kontekst
6. `buildSystemPrompt(perms, isSuperadmin, kbChunks, orgInfo)`
7. `buildAvailableTools(perms)` → schemas dla OpenAI
8. Wywołaj OpenAI z `stream: true`
9. Pętla tool-call: jeśli model żąda toola → wykonaj → wyślij wynik → continue
10. Stream tokenów do klienta przez SSE
11. Po zakończeniu: post-filter (wycięcie kodu dla nie-superadmina), zapis do `ai_assistant_messages`, zapis kosztu do `ai_uzycie`

### `src/routes/api/public/assistant-kb-staleness.ts`
Cron (raz dziennie, wywoływany z pg_cron z `CRON_SECRET`):
- Czyta ostatni `ai_kb_index_runs`
- Jeśli `> 60 dni` → wyślij maila do superadminów Concertivo (przez istniejący system mailowy)

## 5. UI

### `src/components/assistant/AssistantPanel.tsx`
Główny widok czatu (3 kolumny zwijane na mobile):
- Lewa: lista wątków (`<ThreadList />`), button „Nowa rozmowa"
- Środek: `<MessageList />` z streamowaniem + `<ComposerInput />`
- Wiadomości renderowane przez `react-markdown` (już używamy w projekcie? — sprawdzić, ew. dodać)

### `src/components/assistant/ThreadList.tsx`, `MessageList.tsx`, `ComposerInput.tsx`, `MessageBubble.tsx`

### `src/components/assistant/AssistantQuickHints.tsx`
Podpowiedzi „spróbuj zapytać o..." — dynamicznie filtrowane po uprawnieniach usera.

### `src/routes/_authenticated/organizations.$orgId.assistant.tsx`
Nowa route — strona modułu „Asystent" w organizacji.

### `src/lib/org-modules.ts`
Dodać nowy moduł `'assistant'`:
```ts
{ id: "assistant", labelKey: "organizations.sidebar.assistant", alwaysVisible: false, configurable: true }
```

### `src/components/org-sidebar.tsx`
Dodać pozycję w sidebarze (ikona `MessageCircleQuestion` lub `Sparkles`).

### `src/routes/_authenticated.admin.ai.tsx` (rozszerzenie)
Nowa sekcja „Baza wiedzy asystenta":
- Card pokazujący ostatnią reindeksację, liczbę chunków, koszt, dni od ostatniej
- Badge ostrzeżenia gdy > 60 dni
- Button „Przeindeksuj teraz" (long-running, pokazuje progress)
- Tabela `ai_kb_index_runs` — historia
- Nowa sekcja „Asystent — użycie": agregacja `ai_uzycie` gdzie `scenariusz='assistant'` per org + per user, z limitami

## 6. i18n (pl + en)

Klucze: `assistant.title`, `assistant.subtitle`, `assistant.new_thread`, `assistant.placeholder`, `assistant.thinking`, `assistant.error.rate_limit`, `assistant.error.budget_exceeded`, `assistant.error.no_module_access`, `assistant.quick_hints.*`, `organizations.sidebar.assistant`, `admin.ai.kb.*`, `admin.ai.assistant_usage.*`.

## 7. Memory update

Dopisać do `mem://index.md` w sekcji Memories:
- `[Asystent AI](mem://features/assistant)` — Czat AI per org, RAG (docs+code), dziedziczenie uprawnień usera 1:1, klucz systemowy OpenAI, limit per org

I stworzyć `mem://features/assistant` z opisem architektury, lokalizacją plików, zasadami security.

## 8. Kolejność wdrożenia (etapy do commitów)

1. **Migracja 0050** — user wykonuje ręcznie w panelu Supabase
2. **Backend RAG**: `rag.server.ts`, `indexer.server.ts`, początkowe pliki `docs/assistant/00-overview.md` + `01-modules.md` (krótkie, do uzupełnienia)
3. **Backend tools + permissions**: `permissions.server.ts`, `tools.server.ts` z 4–5 podstawowymi toolami (`search_concerts`, `get_concert_details`, `search_contacts`, `list_organization_members`, `search_knowledge_base`)
4. **Backend stream**: `assistant-stream.ts` + `assistant.functions.ts`
5. **UI czatu**: route + komponenty + sidebar entry + i18n
6. **Admin panel**: rozszerzenie `_authenticated.admin.ai.tsx` o KB i usage
7. **Pozostałe toole**: `get_finance_summary`, `list_correspondence`, `get_social_status`, `search_counterparties`, `list_planned_expenses`
8. **Cron staleness** + powiadomienia mailowe
9. **Pełna dokumentacja** `docs/assistant/02-..12-...md`
10. **Memory update**

## 9. Co świadomie pomijamy w MVP

- Write actions (draft maila, tworzenie eventu) — drugi etap
- Voice / multimodal (upload PDF do czatu)
- Eksport rozmowy do pliku
- Współdzielenie wątku między userami
- Inne modele niż OpenAI (architektura zostawia miejsce)
- Per-orgowy override system prompta

## 10. Szacowane koszty (informacyjnie)

- Embedding bazy wiedzy (one-shot ~1500 chunków × ~500 tok): ~0.01 USD
- Reindeksacja całości: ~0.01–0.05 USD zależnie od rozmiaru kodu
- Wiadomość średnia (RAG 3k tok in + 500 tok out, `gpt-5-mini`): ~0.001 USD
- Aktywny user (20 msg/dzień): ~0.6 USD/miesiąc
- Limit org 5 USD/mc ≈ 8–10 aktywnych userów lub 100–150 msg/dzień łącznie

Daj zielone — startuję od migracji 0050 (sam plik SQL, do wykonania ręcznego po Twojej stronie), potem backend.
