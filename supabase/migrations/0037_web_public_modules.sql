-- Moduły WWW (publiczne): Aktualności, Wydarzenia, Galeria (albumy + zdjęcia/wideo)
-- + ustawienia publiczne organizacji, tokeny API i whitelisty domen.
-- i18n: pola tekstowe jako JSONB {"pl":"...","en":"..."} (rozszerzalne).

-- =====================================================================
-- 1) Ustawienia publiczne organizacji
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_public_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_slug text UNIQUE,
  is_published boolean NOT NULL DEFAULT false,
  default_lang text NOT NULL DEFAULT 'pl' CHECK (default_lang IN ('pl','en')),
  available_langs text[] NOT NULL DEFAULT ARRAY['pl','en']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_public_settings_slug
  ON public.org_public_settings(public_slug) WHERE is_published = true;
GRANT SELECT ON public.org_public_settings TO authenticated;
GRANT ALL ON public.org_public_settings TO service_role;
ALTER TABLE public.org_public_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ops_select ON public.org_public_settings;
CREATE POLICY ops_select ON public.org_public_settings
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_public_settings.organization_id AND m.user_id = auth.uid())
  );

-- =====================================================================
-- 2) Tokeny API per org
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_public_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_public_tokens_org
  ON public.org_public_tokens(organization_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.org_public_tokens TO authenticated;
GRANT ALL ON public.org_public_tokens TO service_role;
ALTER TABLE public.org_public_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opt_select ON public.org_public_tokens;
CREATE POLICY opt_select ON public.org_public_tokens
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_public_tokens.organization_id AND m.user_id = auth.uid())
  );

-- =====================================================================
-- 3) Whitelista domen (CORS) per org
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_public_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_org_public_domains_org
  ON public.org_public_domains(organization_id);
GRANT SELECT ON public.org_public_domains TO authenticated;
GRANT ALL ON public.org_public_domains TO service_role;
ALTER TABLE public.org_public_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opd_select ON public.org_public_domains;
CREATE POLICY opd_select ON public.org_public_domains
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_public_domains.organization_id AND m.user_id = auth.uid())
  );

-- =====================================================================
-- 4) AKTUALNOŚCI
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.web_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  excerpt_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_html_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  gallery_image_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  author_name text,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_web_news_org_published
  ON public.web_news(organization_id, published_at DESC) WHERE is_public = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_news TO authenticated;
GRANT ALL ON public.web_news TO service_role;
ALTER TABLE public.web_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_news_select ON public.web_news;
CREATE POLICY web_news_select ON public.web_news
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_news.organization_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS web_news_modify ON public.web_news;
CREATE POLICY web_news_modify ON public.web_news
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_news.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_news.organization_id AND m.user_id = auth.uid()));

-- =====================================================================
-- 5) WYDARZENIA
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.web_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_html_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text NOT NULL DEFAULT 'Europe/Warsaw',
  location_name_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_address text,
  location_lat numeric,
  location_lng numeric,
  performers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ticket_url text,
  ticket_price_from numeric,
  currency text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','cancelled','postponed','sold_out')),
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_web_events_org_starts
  ON public.web_events(organization_id, starts_at DESC) WHERE is_public = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_events TO authenticated;
GRANT ALL ON public.web_events TO service_role;
ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_events_select ON public.web_events;
CREATE POLICY web_events_select ON public.web_events
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_events.organization_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS web_events_modify ON public.web_events;
CREATE POLICY web_events_modify ON public.web_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_events.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_events.organization_id AND m.user_id = auth.uid()));

-- =====================================================================
-- 6) GALERIA — albumy
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.web_gallery_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  event_id uuid REFERENCES public.web_events(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_web_gallery_albums_org_published
  ON public.web_gallery_albums(organization_id, published_at DESC) WHERE is_public = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_gallery_albums TO authenticated;
GRANT ALL ON public.web_gallery_albums TO service_role;
ALTER TABLE public.web_gallery_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wga_select ON public.web_gallery_albums;
CREATE POLICY wga_select ON public.web_gallery_albums
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_gallery_albums.organization_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS wga_modify ON public.web_gallery_albums;
CREATE POLICY wga_modify ON public.web_gallery_albums
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_gallery_albums.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_gallery_albums.organization_id AND m.user_id = auth.uid()));

-- =====================================================================
-- 7) GALERIA — pozycje (zdjęcia / wideo)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.web_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.web_gallery_albums(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video')),
  url text NOT NULL,
  url_thumb text,
  width integer,
  height integer,
  duration_s integer,
  caption_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  photo_credit text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_gallery_items_album_sort
  ON public.web_gallery_items(album_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_web_gallery_items_org
  ON public.web_gallery_items(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_gallery_items TO authenticated;
GRANT ALL ON public.web_gallery_items TO service_role;
ALTER TABLE public.web_gallery_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wgi_select ON public.web_gallery_items;
CREATE POLICY wgi_select ON public.web_gallery_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_gallery_items.organization_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS wgi_modify ON public.web_gallery_items;
CREATE POLICY wgi_modify ON public.web_gallery_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_gallery_items.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_gallery_items.organization_id AND m.user_id = auth.uid()));
