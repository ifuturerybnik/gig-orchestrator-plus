-- Webhooks dla modułów publicznych (news/events/gallery)
-- + log dostaw (success/fail) z liczbą prób

CREATE TABLE IF NOT EXISTS public.web_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[
    'news.published','news.updated','news.deleted',
    'event.published','event.updated','event.deleted',
    'album.published','album.updated','album.deleted'
  ]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_webhooks_org_active
  ON public.web_webhooks(organization_id) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_webhooks TO authenticated;
GRANT ALL ON public.web_webhooks TO service_role;
ALTER TABLE public.web_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_webhooks_select ON public.web_webhooks;
CREATE POLICY web_webhooks_select ON public.web_webhooks
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_webhooks.organization_id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS web_webhooks_modify ON public.web_webhooks;
CREATE POLICY web_webhooks_modify ON public.web_webhooks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_webhooks.organization_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = web_webhooks.organization_id AND m.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.web_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.web_webhooks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code integer,
  ok boolean NOT NULL DEFAULT false,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_webhook_deliveries_hook_time
  ON public.web_webhook_deliveries(webhook_id, created_at DESC);

GRANT SELECT ON public.web_webhook_deliveries TO authenticated;
GRANT ALL ON public.web_webhook_deliveries TO service_role;
ALTER TABLE public.web_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_wd_select ON public.web_webhook_deliveries;
CREATE POLICY web_wd_select ON public.web_webhook_deliveries
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = web_webhook_deliveries.organization_id AND m.user_id = auth.uid())
  );
