-- Add REGON column to public entities
ALTER TABLE public.public_entities
  ADD COLUMN IF NOT EXISTS regon text;
