-- 0008_completed_audit.sql
-- Dodaje informację KTO i KIEDY oznaczył wpis jako zrealizowany.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

alter table public.organization_budget_entries
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.organization_planned_expenses
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz;
