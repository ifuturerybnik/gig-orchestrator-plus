-- 0022_ade_mailboxes.sql
-- Multi-tenant skrzynki e-Doręczeń: każdy user / organizacja / system.
-- Certyfikaty QWAC szyfrowane symetrycznie (EXT_PII_ENCRYPTION_KEY) przed zapisem.

CREATE TABLE IF NOT EXISTS public.ade_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind text NOT NULL CHECK (owner_kind IN ('user','org','system')),
  owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_org_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text,
  mailbox_address text NOT NULL,
  client_id text NOT NULL,
  ade_env text NOT NULL DEFAULT 'prod' CHECK (ade_env IN ('prod','int')),
  api_base text,
  oauth_base text,
  token_path text,
  qwac_cert_pem_encrypted text NOT NULL,
  qwac_key_pem_encrypted text NOT NULL,
  qwac_key_passphrase_encrypted text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ade_mailboxes_owner_matches_kind CHECK (
    (owner_kind = 'user' AND owner_user_id IS NOT NULL AND owner_org_id IS NULL)
    OR (owner_kind = 'org' AND owner_org_id IS NOT NULL AND owner_user_id IS NULL)
    OR (owner_kind = 'system' AND owner_user_id IS NULL AND owner_org_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ade_mailboxes_owner_user ON public.ade_mailboxes (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ade_mailboxes_owner_org ON public.ade_mailboxes (owner_org_id);
CREATE INDEX IF NOT EXISTS idx_ade_mailboxes_owner_kind ON public.ade_mailboxes (owner_kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ade_mailboxes TO authenticated;
GRANT ALL ON public.ade_mailboxes TO service_role;

ALTER TABLE public.ade_mailboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ade_mailboxes_select ON public.ade_mailboxes;
CREATE POLICY ade_mailboxes_select ON public.ade_mailboxes
  FOR SELECT TO authenticated
  USING (
    (owner_kind = 'user' AND owner_user_id = auth.uid())
    OR (owner_kind = 'org' AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = owner_org_id AND m.user_id = auth.uid()
    ))
    OR (owner_kind = 'system' AND (
      public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff')
    ))
  );

DROP POLICY IF EXISTS ade_mailboxes_insert ON public.ade_mailboxes;
CREATE POLICY ade_mailboxes_insert ON public.ade_mailboxes
  FOR INSERT TO authenticated
  WITH CHECK (
    (owner_kind = 'user' AND owner_user_id = auth.uid())
    OR (owner_kind = 'org' AND public.is_owner_of(auth.uid(), owner_org_id))
    OR (owner_kind = 'system' AND public.has_role(auth.uid(),'super_admin'))
  );

DROP POLICY IF EXISTS ade_mailboxes_update ON public.ade_mailboxes;
CREATE POLICY ade_mailboxes_update ON public.ade_mailboxes
  FOR UPDATE TO authenticated
  USING (
    (owner_kind = 'user' AND owner_user_id = auth.uid())
    OR (owner_kind = 'org' AND public.is_owner_of(auth.uid(), owner_org_id))
    OR (owner_kind = 'system' AND public.has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    (owner_kind = 'user' AND owner_user_id = auth.uid())
    OR (owner_kind = 'org' AND public.is_owner_of(auth.uid(), owner_org_id))
    OR (owner_kind = 'system' AND public.has_role(auth.uid(),'super_admin'))
  );

DROP POLICY IF EXISTS ade_mailboxes_delete ON public.ade_mailboxes;
CREATE POLICY ade_mailboxes_delete ON public.ade_mailboxes
  FOR DELETE TO authenticated
  USING (
    (owner_kind = 'user' AND owner_user_id = auth.uid())
    OR (owner_kind = 'org' AND public.is_owner_of(auth.uid(), owner_org_id))
    OR (owner_kind = 'system' AND public.has_role(auth.uid(),'super_admin'))
  );

DROP TRIGGER IF EXISTS ade_mailboxes_updated_at ON public.ade_mailboxes;
CREATE TRIGGER ade_mailboxes_updated_at
  BEFORE UPDATE ON public.ade_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Powiązanie istniejących tabel doręczeń z konkretną skrzynką.
-- Kolumna nullable — Phase 2 refaktoruje kod na mailbox_id i wtedy zrobimy NOT NULL.
ALTER TABLE public.edoreczenia_deliveries
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.ade_mailboxes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_edor_deliveries_mailbox ON public.edoreczenia_deliveries (mailbox_id);

ALTER TABLE public.edoreczenia_sync_state
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.ade_mailboxes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_edor_sync_state_mailbox ON public.edoreczenia_sync_state (mailbox_id);
