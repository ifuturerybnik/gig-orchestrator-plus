-- Add optional time-of-day for performances. Required (at app level) for confirmed statuses.
alter table public.performances
  add column if not exists performance_time time without time zone;
