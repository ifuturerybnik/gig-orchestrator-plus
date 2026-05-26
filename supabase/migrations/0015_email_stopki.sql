-- =====================================================================
-- Concertivo · Korespondencja · Generator stopek e-mail (hybrid scope)
-- Plik wykonujesz RĘCZNIE w SQL editorze zewnętrznego Supabase.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.email_stopki (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nazwa            TEXT NOT NULL,
  domyslna         BOOLEAN NOT NULL DEFAULT false,
  kolor_akcent     TEXT NOT NULL DEFAULT '#1e40af',
  czcionka         TEXT NOT NULL DEFAULT 'Arial, sans-serif',
  imie_nazwisko    TEXT, rola TEXT, adres_firmy TEXT, adres_ikona TEXT,
  nazwa_firmy      TEXT, tekst_dodatkowy TEXT,
  logo_path        TEXT, zdjecie_path TEXT,
  facebook_url     TEXT, instagram_url TEXT, linkedin_url TEXT,
  youtube_url      TEXT, x_url TEXT, tiktok_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_stopki_scope_xor CHECK (
    (owner_user_id IS NOT NULL AND organization_id IS NULL)
    OR (owner_user_id IS NULL AND organization_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_email_stopki_owner ON public.email_stopki(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_email_stopki_org   ON public.email_stopki(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_stopki_one_default_user
  ON public.email_stopki(owner_user_id) WHERE domyslna = true AND owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_stopki_one_default_org
  ON public.email_stopki(organization_id) WHERE domyslna = true AND organization_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_email_stopki_updated_at ON public.email_stopki;
CREATE TRIGGER trg_email_stopki_updated_at BEFORE UPDATE ON public.email_stopki
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.email_stopki ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.is_org_owner(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid() AND role = 'owner')
$$;

DROP POLICY IF EXISTS "stopki_select" ON public.email_stopki;
CREATE POLICY "stopki_select" ON public.email_stopki FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));

DROP POLICY IF EXISTS "stopki_insert" ON public.email_stopki;
CREATE POLICY "stopki_insert" ON public.email_stopki FOR INSERT TO authenticated
  WITH CHECK ((owner_user_id = auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id)));

DROP POLICY IF EXISTS "stopki_update" ON public.email_stopki;
CREATE POLICY "stopki_update" ON public.email_stopki FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id)))
  WITH CHECK (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id)));

DROP POLICY IF EXISTS "stopki_delete" ON public.email_stopki;
CREATE POLICY "stopki_delete" ON public.email_stopki FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id)));

CREATE TABLE IF NOT EXISTS public.email_stopki_pola (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stopka_id   UUID NOT NULL REFERENCES public.email_stopki(id) ON DELETE CASCADE,
  typ         TEXT NOT NULL CHECK (typ IN ('telefon','email','www','social')),
  wartosc     TEXT NOT NULL,
  etykieta    TEXT, ikona TEXT,
  kolejnosc   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_stopki_pola_stopka
  ON public.email_stopki_pola(stopka_id, kolejnosc);
ALTER TABLE public.email_stopki_pola ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stopki_pola_select" ON public.email_stopki_pola;
CREATE POLICY "stopki_pola_select" ON public.email_stopki_pola FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.email_stopki s WHERE s.id = stopka_id
    AND (s.owner_user_id = auth.uid()
      OR (s.organization_id IS NOT NULL AND public.is_org_member(s.organization_id)))));

DROP POLICY IF EXISTS "stopki_pola_write" ON public.email_stopki_pola;
CREATE POLICY "stopki_pola_write" ON public.email_stopki_pola FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.email_stopki s WHERE s.id = stopka_id
    AND (s.owner_user_id = auth.uid()
      OR (s.organization_id IS NOT NULL AND public.is_org_owner(s.organization_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.email_stopki s WHERE s.id = stopka_id
    AND (s.owner_user_id = auth.uid()
      OR (s.organization_id IS NOT NULL AND public.is_org_owner(s.organization_id)))));

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('stopki-grafiki', 'stopki-grafiki', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "stopki_grafiki_public_read" ON storage.objects;
CREATE POLICY "stopki_grafiki_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'stopki-grafiki');

DROP POLICY IF EXISTS "stopki_grafiki_upload" ON storage.objects;
CREATE POLICY "stopki_grafiki_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stopki-grafiki' AND (
    (split_part(name,'/',1) = auth.uid()::text)
    OR (split_part(name,'/',1) = 'org' AND public.is_org_owner(split_part(name,'/',2)::uuid))
  ));

DROP POLICY IF EXISTS "stopki_grafiki_update" ON storage.objects;
CREATE POLICY "stopki_grafiki_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'stopki-grafiki' AND (
    (split_part(name,'/',1) = auth.uid()::text)
    OR (split_part(name,'/',1) = 'org' AND public.is_org_owner(split_part(name,'/',2)::uuid))
  ));

DROP POLICY IF EXISTS "stopki_grafiki_delete" ON storage.objects;
CREATE POLICY "stopki_grafiki_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stopki-grafiki' AND (
    (split_part(name,'/',1) = auth.uid()::text)
    OR (split_part(name,'/',1) = 'org' AND public.is_org_owner(split_part(name,'/',2)::uuid))
  ));
