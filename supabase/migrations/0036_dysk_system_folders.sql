-- Dysk: foldery systemowe (is_system) — nie można ich usuwać ani zmieniać nazwy.
-- Tworzone automatycznie przy pierwszym wejściu organizacji do modułu Dysk.

ALTER TABLE public.org_storage_objects
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_org_storage_obj_org_mod_key
  ON public.org_storage_objects(organization_id, module, object_key);
