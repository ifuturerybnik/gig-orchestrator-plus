-- Add 'confirmed' value to performance_status enum
alter type public.performance_status add value if not exists 'confirmed' after 'tentative';
