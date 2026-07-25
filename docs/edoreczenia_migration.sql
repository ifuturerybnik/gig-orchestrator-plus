-- Uruchom w Supabase SQL Editor (external DB):
CREATE TABLE IF NOT EXISTS public.edoreczenia_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  ade_message_id text UNIQUE,
  mailbox_address text NOT NULL,
  from_address text,
  to_address text,
  subject text,
  sent_at timestamptz,
  received_at timestamptz,
  status text NOT NULL DEFAULT 'new',
  raw jsonb,
  body_text text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoreczenia_deliveries TO authenticated;
GRANT ALL ON public.edoreczenia_deliveries TO service_role;
ALTER TABLE public.edoreczenia_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_edoreczenia_deliveries"
  ON public.edoreczenia_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'));
CREATE INDEX IF NOT EXISTS idx_edor_deliveries_received_at ON public.edoreczenia_deliveries (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_edor_deliveries_direction ON public.edoreczenia_deliveries (direction);

CREATE TABLE IF NOT EXISTS public.edoreczenia_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.edoreczenia_deliveries(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  ade_attachment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoreczenia_attachments TO authenticated;
GRANT ALL ON public.edoreczenia_attachments TO service_role;
ALTER TABLE public.edoreczenia_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_edoreczenia_attachments"
  ON public.edoreczenia_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'));

CREATE TABLE IF NOT EXISTS public.edoreczenia_sync_state (
  mailbox_address text PRIMARY KEY,
  last_synced_at timestamptz,
  last_cursor text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edoreczenia_sync_state TO authenticated;
GRANT ALL ON public.edoreczenia_sync_state TO service_role;
ALTER TABLE public.edoreczenia_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_edoreczenia_sync_state"
  ON public.edoreczenia_sync_state FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'));
