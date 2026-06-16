-- =====================================================================
-- Migracja: Integracja GUS (BIR 1.1) — tabele cache + sesja
-- Uruchom w SQL Editor w Supabase (baza Concertivo)
-- =====================================================================

-- 1. Tabela sesji GUS (jeden wiersz, id=1, sid ważny ~60 min)
CREATE TABLE IF NOT EXISTS public.gus_sesja (
  id          INTEGER PRIMARY KEY,
  sid         TEXT NOT NULL,
  utworzono   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gus_sesja TO authenticated;
GRANT ALL ON public.gus_sesja TO service_role;

ALTER TABLE public.gus_sesja ENABLE ROW LEVEL SECURITY;

-- Tylko service_role może czytać/pisać sesję (zawiera token GUS)
CREATE POLICY "service_role manages gus_sesja"
  ON public.gus_sesja FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. Tabela cache wyników z GUS (TTL 7 dni — logika w edge function)
CREATE TABLE IF NOT EXISTS public.gus_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nip         TEXT UNIQUE,
  regon       TEXT UNIQUE,
  krs         TEXT UNIQUE,
  dane        JSONB NOT NULL,
  pobrano     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gus_cache_nip_idx   ON public.gus_cache(nip);
CREATE INDEX IF NOT EXISTS gus_cache_regon_idx ON public.gus_cache(regon);
CREATE INDEX IF NOT EXISTS gus_cache_krs_idx   ON public.gus_cache(krs);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gus_cache TO authenticated;
GRANT ALL ON public.gus_cache TO service_role;

ALTER TABLE public.gus_cache ENABLE ROW LEVEL SECURITY;

-- Zalogowani użytkownicy mogą czytać cache (dane firm są publiczne w GUS)
CREATE POLICY "authenticated read gus_cache"
  ON public.gus_cache FOR SELECT
  TO authenticated
  USING (true);

-- Zapis tylko z edge function (service_role)
CREATE POLICY "service_role writes gus_cache"
  ON public.gus_cache FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
