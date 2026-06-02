-- Warianty obrazów (thumb / medium / original) dla org_storage_objects.
-- Pliki uploadowane przez <ImageUploader/> są przed wysłaniem przetwarzane
-- po stronie klienta (Canvas API, WebP) na 3 rozmiary. Wszystkie 3 lądują
-- jako osobne wiersze; thumb/medium mają parent_id wskazujący na 'original'.

ALTER TABLE public.org_storage_objects
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'original'
    CHECK (variant IN ('original','medium','thumb')),
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.org_storage_objects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_org_storage_obj_parent
  ON public.org_storage_objects(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_storage_obj_variant
  ON public.org_storage_objects(organization_id, variant);
