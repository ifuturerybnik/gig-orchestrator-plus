-- 0007_budget_completed.sql
-- Dodaje kolumnę "completed" do tabeli budżetu.
-- Pozycje niezrealizowane są wyświetlane na czerwono i NIE są wliczane do podsumowania.
-- Domyślnie true, aby istniejące wpisy pozostały wliczone w sumę.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

alter table public.organization_budget_entries
  add column if not exists completed boolean not null default true;
