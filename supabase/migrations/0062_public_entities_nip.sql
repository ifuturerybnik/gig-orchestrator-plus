-- Add NIP column to public entities
ALTER TABLE public.public_entities
  ADD COLUMN IF NOT EXISTS nip text;
