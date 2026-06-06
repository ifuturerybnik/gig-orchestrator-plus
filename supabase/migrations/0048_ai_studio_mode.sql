-- 0048_ai_studio_mode.sql
-- AI Studio = niezależny moduł operacyjny mediów (SM + WWW).
-- Większość członków organizacji ma dostęp wyłącznie do AI Studio,
-- a do modułów "Organizacja SM" i "Web" tylko admini/integratorzy.
--
-- Tryby per-członek:
--   'full'             → wszystko (tworzenie, publikacja, moderacja, analityka)
--   'create_only'      → Tworzenie + Kalendarz + Biblioteka
--   'moderation_only'  → Skrzynka + Asystent
--   'view_only'        → Dashboard + Biblioteka + Analityka

ALTER TABLE public.organization_member_permissions
  ADD COLUMN IF NOT EXISTS ai_studio_mode text NOT NULL DEFAULT 'full'
    CHECK (ai_studio_mode IN ('full','create_only','moderation_only','view_only'));

COMMENT ON COLUMN public.organization_member_permissions.ai_studio_mode IS
  'Tryb dostępu do AI Studio: full | create_only | moderation_only | view_only.';
