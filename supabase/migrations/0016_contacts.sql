-- =====================================================================
-- Concertivo · Moduł Kontakty (hybrid scope: user OR organization)
-- 3 typy: person | company | artist  (jedna tabela + CHECK)
-- Wykonujesz RĘCZNIE w SQL editorze zewnętrznego Supabase.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----- Enumy ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.contact_kind AS ENUM ('person','company','artist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_category AS ENUM
    ('client','supplier','artist','partner','venue','media','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_artist_type AS ENUM ('solo','band','ensemble','dj');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_activity_kind AS ENUM ('call','meeting','note','task','email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- Tabela contacts ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind                  public.contact_kind NOT NULL,
  category              public.contact_category,
  display_name          TEXT NOT NULL DEFAULT '',
  email                 TEXT,
  phone                 TEXT,
  website               TEXT,
  country_code          TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  city                  TEXT,
  postal_code           TEXT,
  region                TEXT,
  notes                 JSONB,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  source                TEXT,
  preferred_language    TEXT,
  assigned_to_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  custom_fields         JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_name            TEXT,
  last_name             TEXT,
  middle_name           TEXT,
  position              TEXT,
  company_contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  birth_date            DATE,
  social                JSONB,
  legal_name            TEXT,
  tax_id                TEXT,
  registration_no       TEXT,
  artist_type           public.contact_artist_type,
  genres                TEXT[],
  rider_url             TEXT,
  tech_rider_url        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_scope_xor CHECK (
    (owner_user_id IS NOT NULL AND organization_id IS NULL)
    OR (owner_user_id IS NULL AND organization_id IS NOT NULL)
  ),
  CONSTRAINT contacts_assigned_only_org CHECK (
    assigned_to_user_id IS NULL OR organization_id IS NOT NULL
  )
);

CREATE OR REPLACE FUNCTION public.contacts_set_display_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'person' THEN
    NEW.display_name := NULLIF(TRIM(
      COALESCE(NEW.first_name,'') ||
      CASE WHEN NEW.middle_name IS NOT NULL AND NEW.middle_name <> ''
           THEN ' ' || NEW.middle_name ELSE '' END ||
      CASE WHEN NEW.last_name IS NOT NULL AND NEW.last_name <> ''
           THEN ' ' || NEW.last_name ELSE '' END
    ), '');
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
      NEW.display_name := COALESCE(NEW.email, '(bez nazwy)');
    END IF;
  ELSE
    IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
      NEW.display_name := COALESCE(NEW.legal_name, NEW.email, '(bez nazwy)');
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_display_name ON public.contacts;
CREATE TRIGGER trg_contacts_display_name
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_set_display_name();

CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org   ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_kind ON public.contacts(organization_id, kind);
CREATE INDEX IF NOT EXISTS idx_contacts_kind  ON public.contacts(kind);
CREATE INDEX IF NOT EXISTS idx_contacts_tags  ON public.contacts USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_dn_trgm ON public.contacts USING gin(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));

DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK ((owner_user_id = auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));

DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)))
  WITH CHECK (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));

DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id)));

-- ----- contact_members (zespół ↔ osoby) ----------------------------
CREATE TABLE IF NOT EXISTS public.contact_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_contact_id     UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  person_contact_id   UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role                TEXT,
  is_leader           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (band_contact_id, person_contact_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_members_band   ON public.contact_members(band_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_members_person ON public.contact_members(person_contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_members TO authenticated;
GRANT ALL ON public.contact_members TO service_role;

ALTER TABLE public.contact_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_members_all" ON public.contact_members;
CREATE POLICY "contact_members_all" ON public.contact_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c
                 WHERE c.id = band_contact_id
                   AND (c.owner_user_id = auth.uid()
                        OR (c.organization_id IS NOT NULL AND public.is_org_member(c.organization_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts c
                 WHERE c.id = band_contact_id
                   AND (c.owner_user_id = auth.uid()
                        OR (c.organization_id IS NOT NULL AND public.is_org_member(c.organization_id)))));

-- ----- contact_activity ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id     UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind           public.contact_activity_kind NOT NULL,
  subject        TEXT,
  body_json      JSONB,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_activity_contact ON public.contact_activity(contact_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_activity TO authenticated;
GRANT ALL ON public.contact_activity TO service_role;

ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_activity_all" ON public.contact_activity;
CREATE POLICY "contact_activity_all" ON public.contact_activity FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c
                 WHERE c.id = contact_id
                   AND (c.owner_user_id = auth.uid()
                        OR (c.organization_id IS NOT NULL AND public.is_org_member(c.organization_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts c
                 WHERE c.id = contact_id
                   AND (c.owner_user_id = auth.uid()
                        OR (c.organization_id IS NOT NULL AND public.is_org_member(c.organization_id)))));

-- ----- contact_custom_field_defs ------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_custom_field_defs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind          public.contact_kind NOT NULL,
  key           TEXT NOT NULL,
  label_i18n    JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_type    TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','bool')),
  options       JSONB,
  position      INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, kind, key)
);
CREATE INDEX IF NOT EXISTS idx_ccfd_org_kind ON public.contact_custom_field_defs(org_id, kind, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_custom_field_defs TO authenticated;
GRANT ALL ON public.contact_custom_field_defs TO service_role;

ALTER TABLE public.contact_custom_field_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccfd_select" ON public.contact_custom_field_defs;
CREATE POLICY "ccfd_select" ON public.contact_custom_field_defs FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "ccfd_write" ON public.contact_custom_field_defs;
CREATE POLICY "ccfd_write" ON public.contact_custom_field_defs FOR ALL TO authenticated
  USING (public.is_org_owner(org_id))
  WITH CHECK (public.is_org_owner(org_id));
