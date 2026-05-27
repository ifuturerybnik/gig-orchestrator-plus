-- Integracja AI (OpenAI): konfiguracja singletonowa + log wywołań.
-- Dostęp wyłącznie dla administratorów (super_admin / admin_staff).
-- Wywołania API są wykonywane z server fn (RLS bypass via service role),
-- więc na tabelach NIE ma policy dla zwykłych userów.

CREATE TABLE IF NOT EXISTS public.ai_konfiguracja (
  id integer PRIMARY KEY DEFAULT 1,
  provider text NOT NULL DEFAULT 'openai',
  default_model text NOT NULL DEFAULT 'gpt-4o-mini',
  models jsonb NOT NULL DEFAULT '["gpt-4o-mini","gpt-4o","gpt-4.1-mini","gpt-4.1","gpt-5-mini","gpt-5"]'::jsonb,
  scenariusz_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  monthly_limit_usd numeric NOT NULL DEFAULT 50,
  enabled boolean NOT NULL DEFAULT true,
  system_prompt text,
  temperature numeric NOT NULL DEFAULT 0.7,
  max_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_konfiguracja_singleton CHECK (id = 1)
);

INSERT INTO public.ai_konfiguracja (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.ai_konfiguracja TO authenticated;
GRANT ALL ON public.ai_konfiguracja TO service_role;

ALTER TABLE public.ai_konfiguracja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_konf_admin_select ON public.ai_konfiguracja;
CREATE POLICY ai_konf_admin_select ON public.ai_konfiguracja
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
  );

DROP POLICY IF EXISTS ai_konf_admin_update ON public.ai_konfiguracja;
CREATE POLICY ai_konf_admin_update ON public.ai_konfiguracja
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
  );

CREATE TABLE IF NOT EXISTS public.ai_uzycie (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  scenariusz text NOT NULL DEFAULT 'inne',
  model text NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_uzycie_created ON public.ai_uzycie(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_uzycie_user    ON public.ai_uzycie(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_uzycie_scen    ON public.ai_uzycie(scenariusz);
CREATE INDEX IF NOT EXISTS idx_ai_uzycie_model   ON public.ai_uzycie(model);

GRANT SELECT ON public.ai_uzycie TO authenticated;
GRANT ALL ON public.ai_uzycie TO service_role;

ALTER TABLE public.ai_uzycie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_uzycie_admin_select ON public.ai_uzycie;
CREATE POLICY ai_uzycie_admin_select ON public.ai_uzycie
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_id = auth.uid()
  );
