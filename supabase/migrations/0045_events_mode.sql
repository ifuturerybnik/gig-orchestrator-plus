-- 0045_events_mode.sql
-- Sub-tryb dla modułu 'events':
--   'full'                 → pełne uprawnienia (dodawanie/edycja/usuwanie),
--   'view_only'            → tylko podgląd wszystkich wydarzeń (bez edycji),
--   'view_confirmed_only'  → tylko podgląd wydarzeń o statusie confirmed/confirmed_signing/confirmed_signed.
-- Reguły analogiczne do `budget_mode`: relevantne tylko gdy moduł 'events' jest w `modules`
-- i `is_org_admin = false`. Owner organizacji oraz administrator aplikacji zawsze mają pełen dostęp.

ALTER TABLE public.organization_member_permissions
  ADD COLUMN IF NOT EXISTS events_mode text NOT NULL DEFAULT 'full'
    CHECK (events_mode IN ('full','view_only','view_confirmed_only'));

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS initial_events_mode text NOT NULL DEFAULT 'full'
    CHECK (initial_events_mode IN ('full','view_only','view_confirmed_only'));
