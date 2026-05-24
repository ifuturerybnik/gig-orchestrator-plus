-- 0009_budget_update_policy.sql
-- Pozwala członkom organizacji i administratorom aktualizować wpisy budżetu,
-- m.in. zaznaczać/odznaczać kolumnę "Zrealizowano" z poziomu tabeli.
-- Uruchom ręcznie w panelu zewnętrznego Supabase (SQL editor).

drop policy if exists "budget_update_member_or_admin" on public.organization_budget_entries;
create policy "budget_update_member_or_admin" on public.organization_budget_entries
  for update to authenticated
  using (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  )
  with check (
    public.is_member_of(auth.uid(), organization_id)
    or public.is_admin(auth.uid())
  );