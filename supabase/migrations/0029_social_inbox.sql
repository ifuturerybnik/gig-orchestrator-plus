-- 0029_social_inbox.sql — Skrzynka i moderacja dla modułu Organizacja SM
-- Tabele:
--   social_comments         — komentarze pod postami (FB/IG/YT/LI/TT/X) z zewnętrznych API
--   social_messages         — DM-y (FB Messenger, IG DM)
--   social_moderation_log   — audyt akcji moderacyjnych (reply/hide/delete/spam/ban)
-- W turze 1: szkielet danych (tabele puste). W turze 2+ uzupełnia synchronizator OAuth + webhooki.

-- 1) social_comments
create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  post_id uuid references public.social_posts(id) on delete set null,
  external_post_id text not null,
  external_comment_id text not null,
  external_parent_comment_id text,
  author_external_id text,
  author_name text,
  author_avatar_url text,
  content text not null default '',
  permalink text,
  posted_at timestamptz,
  status text not null default 'new',
    -- 'new' | 'replied' | 'hidden' | 'deleted' | 'spam' | 'archived'
  ai_sentiment text,
  ai_flags jsonb not null default '[]'::jsonb,
  ai_suggested_reply text,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  unique (account_id, external_comment_id)
);

create index if not exists social_comments_org_idx on public.social_comments (organization_id);
create index if not exists social_comments_account_idx on public.social_comments (account_id);
create index if not exists social_comments_status_idx on public.social_comments (organization_id, status, posted_at desc);
create index if not exists social_comments_post_idx on public.social_comments (post_id);

grant select, insert, update, delete on public.social_comments to authenticated;
grant all on public.social_comments to service_role;

alter table public.social_comments enable row level security;

drop policy if exists "social_comments_select" on public.social_comments;
create policy "social_comments_select" on public.social_comments for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_comments_insert" on public.social_comments;
create policy "social_comments_insert" on public.social_comments for insert to authenticated
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_comments_update" on public.social_comments;
create policy "social_comments_update" on public.social_comments for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_comments_delete" on public.social_comments;
create policy "social_comments_delete" on public.social_comments for delete to authenticated
  using (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

-- 2) social_messages (DM: FB Messenger, IG DM)
create table if not exists public.social_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  external_thread_id text not null,
  external_message_id text not null,
  direction text not null default 'inbound',
  author_external_id text,
  author_name text,
  author_avatar_url text,
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  posted_at timestamptz,
  status text not null default 'new',
  ai_sentiment text,
  ai_flags jsonb not null default '[]'::jsonb,
  ai_suggested_reply text,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  unique (account_id, external_message_id)
);

create index if not exists social_messages_org_idx on public.social_messages (organization_id);
create index if not exists social_messages_thread_idx on public.social_messages (account_id, external_thread_id, posted_at desc);
create index if not exists social_messages_status_idx on public.social_messages (organization_id, status, posted_at desc);

grant select, insert, update, delete on public.social_messages to authenticated;
grant all on public.social_messages to service_role;

alter table public.social_messages enable row level security;

drop policy if exists "social_messages_select" on public.social_messages;
create policy "social_messages_select" on public.social_messages for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_messages_insert" on public.social_messages;
create policy "social_messages_insert" on public.social_messages for insert to authenticated
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_messages_update" on public.social_messages;
create policy "social_messages_update" on public.social_messages for update to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()))
  with check (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_messages_delete" on public.social_messages;
create policy "social_messages_delete" on public.social_messages for delete to authenticated
  using (public.is_owner_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

-- 3) social_moderation_log — audyt akcji moderacyjnych
create table if not exists public.social_moderation_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.social_accounts(id) on delete set null,
  comment_id uuid references public.social_comments(id) on delete set null,
  message_id uuid references public.social_messages(id) on delete set null,
  action text not null,
    -- 'reply' | 'hide' | 'unhide' | 'delete' | 'mark_spam' | 'ban_user' | 'archive' | 'ai_suggest'
  payload jsonb not null default '{}'::jsonb,
  result text not null default 'ok',
  error_message text,
  performed_by uuid references auth.users(id),
  performed_at timestamptz not null default now()
);

create index if not exists social_moderation_log_org_idx on public.social_moderation_log (organization_id, performed_at desc);
create index if not exists social_moderation_log_comment_idx on public.social_moderation_log (comment_id);
create index if not exists social_moderation_log_message_idx on public.social_moderation_log (message_id);

grant select, insert on public.social_moderation_log to authenticated;
grant all on public.social_moderation_log to service_role;

alter table public.social_moderation_log enable row level security;

drop policy if exists "social_moderation_log_select" on public.social_moderation_log;
create policy "social_moderation_log_select" on public.social_moderation_log for select to authenticated
  using (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid()));

drop policy if exists "social_moderation_log_insert" on public.social_moderation_log;
create policy "social_moderation_log_insert" on public.social_moderation_log for insert to authenticated
  with check (performed_by = auth.uid() and (public.is_member_of(auth.uid(), organization_id) or public.is_admin(auth.uid())));
