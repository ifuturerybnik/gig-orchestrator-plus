-- 0040_member_permissions.sql
-- Kontrola dostępu członków organizacji do wybranych modułów.
-- Każdy członek (poza ownerem) może mieć:
--   - is_org_admin=true  → pełny dostęp do wszystkich modułów,
--   - is_org_admin=false → dostęp tylko do modułów wymienionych w `modules` (jsonb array of text).
-- Specjalny tryb dla modułu 'budget':
--   - 'full'             → pełne uprawnienia,
--   - 'unrealized_only'  → może dodawać wpisy (zawsze ze statusem niezrealizowane),
--                          nie może zaznaczać "Zrealizowano".
-- Brak wpisu = pełen dostęp (kompatybilność wsteczna dla istniejących członków).
-- Owner organizacji oraz administratorzy aplikacji (super_admin/admin_staff)
-- mają zawsze pełen dostęp, niezależnie od tej tabeli.

CREATE TABLE IF NOT EXISTS public.organization_member_permissions (
  member_id       uuid PRIMARY KEY REFERENCES public.organization_members(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_org_admin    boolean NOT NULL DEFAULT false,
  modules         jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_mode     text NOT NULL DEFAULT 'full'
    CHECK (budget_mode IN ('full','unrealized_only')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_omp_org_user
  ON public.organization_member_permissions(organization_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_member_permissions TO authenticated;
GRANT ALL ON public.organization_member_permissions TO service_role;

ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT: członek tej samej organizacji lub admin aplikacji
DROP POLICY IF EXISTS omp_select ON public.organization_member_permissions;
CREATE POLICY omp_select ON public.organization_member_permissions
  FOR SELECT TO authenticated
  USING (
    public.is_member_of(auth.uid(), organization_id)
    OR public.is_admin(auth.uid())
  );

-- INSERT / UPDATE / DELETE: tylko owner danej org lub admin aplikacji
DROP POLICY IF EXISTS omp_modify ON public.organization_member_permissions;
CREATE POLICY omp_modify ON public.organization_member_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = organization_member_permissions.organization_id
         AND om.user_id = auth.uid()
         AND om.role = 'owner'
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = organization_member_permissions.organization_id
         AND om.user_id = auth.uid()
         AND om.role = 'owner'
    )
    OR public.is_admin(auth.uid())
  );

-- Helper: czy user może oznaczać wpisy budżetowe jako "Zrealizowano" w danej org.
-- Owner i admin aplikacji zawsze TAK. Brak wpisu uprawnień = TAK (kompatybilność).
-- Inaczej: is_org_admin=true LUB (budżet w modules AND budget_mode='full').
CREATE OR REPLACE FUNCTION public.member_can_complete_budget(_user uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _user
         AND ur.role IN ('super_admin','admin_staff')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = _user
         AND om.organization_id = _org
         AND om.role = 'owner'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
       LEFT JOIN public.organization_member_permissions p ON p.member_id = om.id
       WHERE om.user_id = _user
         AND om.organization_id = _org
         AND (
           p.member_id IS NULL
           OR p.is_org_admin = true
           OR (p.modules ? 'budget' AND COALESCE(p.budget_mode,'full') = 'full')
         )
    );
$$;

-- Zaostrzenie polityki UPDATE dla organization_budget_entries:
DROP POLICY IF EXISTS "budget_update_member_or_admin" ON public.organization_budget_entries;
CREATE POLICY "budget_update_member_or_admin" ON public.organization_budget_entries
  FOR UPDATE TO authenticated
  USING (
    public.is_member_of(auth.uid(), organization_id)
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    (
      public.is_member_of(auth.uid(), organization_id)
      OR public.is_admin(auth.uid())
    )
    AND (
      completed = false
      OR public.member_can_complete_budget(auth.uid(), organization_id)
    )
  );
