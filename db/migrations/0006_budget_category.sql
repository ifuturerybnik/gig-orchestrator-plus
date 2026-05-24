-- 0006_budget_category.sql
-- Dodaje kolumnę "category" do tabel budżetu i przyszłych wydatków.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

alter table public.organization_budget_entries
  add column if not exists category text;

alter table public.organization_budget_entries
  drop constraint if exists budget_entries_category_length;
alter table public.organization_budget_entries
  add constraint budget_entries_category_length
  check (category is null or length(category) between 1 and 80);

alter table public.organization_planned_expenses
  add column if not exists category text;

alter table public.organization_planned_expenses
  drop constraint if exists planned_expenses_category_length;
alter table public.organization_planned_expenses
  add constraint planned_expenses_category_length
  check (category is null or length(category) between 1 and 80);
