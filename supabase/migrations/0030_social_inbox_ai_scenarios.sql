-- 0030_social_inbox_ai_scenarios.sql — dodaje scenariusze AI dla skrzynki SM
-- social_inbox_reply_suggest    — AI proponuje 3 warianty odpowiedzi na komentarz
-- social_inbox_moderate         — AI klasyfikuje sentyment + flagi (hate/spam/urgent/question)

do $$
begin
  if exists (select 1 from public.ai_konfiguracja where id = 1) then
    update public.ai_konfiguracja
       set scenariusz_model = coalesce(scenariusz_model, '{}'::jsonb)
         || jsonb_build_object(
              'social_inbox_reply_suggest', coalesce(scenariusz_model->>'social_inbox_reply_suggest', default_model),
              'social_inbox_moderate',      coalesce(scenariusz_model->>'social_inbox_moderate',      default_model)
            ),
           updated_at = now()
     where id = 1;
  end if;
end $$;

-- Indexy wspierające widok "nowych" w skrzynce
create index if not exists social_comments_new_idx
  on public.social_comments (organization_id, posted_at desc)
  where status = 'new';

create index if not exists social_messages_new_idx
  on public.social_messages (organization_id, posted_at desc)
  where status = 'new';

notify pgrst, 'reload schema';
