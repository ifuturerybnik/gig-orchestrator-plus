-- Storage R2: Model 2 (centralny Concertivo) + Model 3 (własne R2 organizacji).
-- Konfiguracja globalna + per-org tryb i kwoty + rejestr obiektów.

-- =====================================================================
-- 1) Konfiguracja globalna (singleton, id=1) — tylko super_admin może zmieniać.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.storage_global_config (
  id integer PRIMARY KEY DEFAULT 1,
  free_quota_gb numeric NOT NULL DEFAULT 2,
  price_per_extra_gb_pln numeric NOT NULL DEFAULT 0.25,
  max_image_mb integer NOT NULL DEFAULT 50,
  max_video_mb integer NOT NULL DEFAULT 200,
  central_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT storage_global_config_singleton CHECK (id = 1)
);

INSERT INTO public.storage_global_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.storage_global_config TO authenticated;
GRANT ALL ON public.storage_global_config TO service_role;
ALTER TABLE public.storage_global_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_gc_select ON public.storage_global_config;
CREATE POLICY storage_gc_select ON public.storage_global_config
  FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- 2) Konfiguracja per-organizacja: tryb, bonusy, klucze własnego R2.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_storage_config (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'central' CHECK (mode IN ('central','own')),
  bonus_free_gb numeric NOT NULL DEFAULT 0,
  paid_extra_gb numeric NOT NULL DEFAULT 0,
  bonus_note text,
  r2_account_id text,
  r2_access_key_id_enc text,
  r2_secret_access_key_enc text,
  r2_bucket text,
  r2_endpoint text,
  r2_public_base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.org_storage_config TO authenticated;
GRANT ALL ON public.org_storage_config TO service_role;
ALTER TABLE public.org_storage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_storage_cfg_select ON public.org_storage_config;
CREATE POLICY org_storage_cfg_select ON public.org_storage_config
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_storage_config.organization_id
        AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_storage_config.organization_id
        AND o.created_by = auth.uid()
    )
  );

-- =====================================================================
-- 3) Rejestr obiektów (plików).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('central','own')),
  bucket text NOT NULL,
  object_key text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime text,
  module text NOT NULL DEFAULT 'misc',
  entity_id uuid,
  public_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','deleted')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_storage_obj_org_mod
  ON public.org_storage_objects(organization_id, module);
CREATE INDEX IF NOT EXISTS idx_org_storage_obj_org_created
  ON public.org_storage_objects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_storage_obj_status
  ON public.org_storage_objects(status);

GRANT SELECT ON public.org_storage_objects TO authenticated;
GRANT ALL ON public.org_storage_objects TO service_role;
ALTER TABLE public.org_storage_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_storage_obj_select ON public.org_storage_objects;
CREATE POLICY org_storage_obj_select ON public.org_storage_objects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_storage_objects.organization_id
        AND m.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 4) Widok zużycia per organizacja.
-- =====================================================================
CREATE OR REPLACE VIEW public.org_storage_usage AS
SELECT
  organization_id,
  COALESCE(SUM(size_bytes) FILTER (WHERE status = 'ready' AND mode = 'central'), 0)::bigint
    AS used_bytes_central,
  COALESCE(SUM(size_bytes) FILTER (WHERE status = 'ready' AND mode = 'own'), 0)::bigint
    AS used_bytes_own,
  COUNT(*) FILTER (WHERE status = 'ready')::bigint AS objects_count
FROM public.org_storage_objects
GROUP BY organization_id;

GRANT SELECT ON public.org_storage_usage TO authenticated;
GRANT ALL ON public.org_storage_usage TO service_role;
