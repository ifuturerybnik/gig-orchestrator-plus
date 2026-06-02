# Plan zmian

## 1) Domyślnie wszystkie uprawnienia WYŁĄCZONE w zaproszeniu

W `src/routes/_authenticated.organizations.$orgId.members.tsx`:
- Zmienić inicjalizację `inviteModules` z `new Set(CONFIGURABLE_MODULE_IDS)` na pusty `new Set()`.
- `inviteIsOrgAdmin` zostaje `false` (już jest).

W `src/lib/organizations.functions.ts`:
- `InvitationAccessSchema.modules.default` zmienić z `DEFAULT_INVITATION_MODULES` na `[]`.

## 2) Rola "właściciel" przy zaproszeniu

W bieżącym modelu `organization_members.role` ma już `'owner'` / `'member'`. Dodajemy możliwość zapraszania od razu jako owner.

**Migracja `0043_invitation_owner_role.sql`:**
- `alter table organization_invitations add column if not exists initial_role text not null default 'member' check (initial_role in ('member','owner'));`

**Backend (`organizations.functions.ts`):**
- `InvitationAccessSchema` + nowe pole `asOwner: boolean` (default false).
- W `inviteUserToOrganization`:
  - Wymagać aby zapraszający był ownerem (lub super_admin), jeśli `asOwner === true`. Adminowie aplikacji ok.
  - Zapis do `initial_role`.
- W `acceptInvitation` (src/lib/invitations.functions.ts) — przy tworzeniu `organization_members` ustawić `role = invitation.initial_role`. Jeśli owner — nie wpisywać `organization_member_permissions` (owner ma pełen dostęp z definicji).

**UI (members.tsx):**
- Nowy switch "Zaproś jako właściciel" widoczny tylko jeśli `currentUserIsOwner` (z `detailsQuery.data`, dodać flagę).
- Gdy zaznaczone — pola `OrgPermissionsFields` ukryte (owner = pełen dostęp).

**Sidebar/uprawnienia:** istniejąca logika już daje ownerom pełen dostęp; nie zmieniamy.

**Usuwanie org / zapraszanie ownerów:** `deleteOrganization` już dziś wymaga ownera (zachować). W `inviteUserToOrganization` dodać check `asOwner ⇒ caller is owner`.

## 3) Miękkie usuwanie organizacji (7 dni)

**Migracja `0044_org_pending_deletion.sql`:**
```sql
alter table public.organizations
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users(id);

create index if not exists organizations_pending_deletion_idx
  on public.organizations (deletion_scheduled_for)
  where deletion_scheduled_for is not null;
```

**Backend — `organizations.functions.ts`:**
- Zamiast natychmiastowego `deleteOrganization` (zostawić jako `forceDeleteOrganization` dla admina aplikacji), nowe:
  - `requestOrganizationDeletion({ organizationId })` — owner only. Ustawia `deletion_requested_at = now()`, `deletion_scheduled_for = now() + 7 days`, `deletion_requested_by = uid`. Wstawia `user_notifications` (kind `org_deletion_requested`) dla wszystkich członków org z payloadem `{organization_id, organization_name, scheduled_for}`.
  - `cancelOrganizationDeletion({ organizationId })` — owner only. Zeruje pola. Wstawia notyfikacje `org_deletion_cancelled` dla członków.
- `getOrganizationDetails` zwraca dodatkowo `deletionRequestedAt`, `deletionScheduledFor`, `deletionRequestedBy`.

**Cron / auto-purge:**
- Nowy endpoint `src/routes/api/public/org-deletion-tick.ts` (Bearer `CRON_SECRET`) — wybiera org z `deletion_scheduled_for <= now()`, dla każdej wykonuje pełne usunięcie (delegacja do helpera używanego przez stare `deleteOrganization`).
- Wpis w `vps/server.mjs` cron (lub instrukcja dla użytkownika do pg_cron). Na razie dodam endpoint + dopiszę do istniejącego pliku cron-runnera jeśli jest, w przeciwnym razie udokumentuję w `vps/README` że trzeba dodać harmonogram.

**UI:**
- `src/routes/_authenticated.organizations.$orgId.profile.tsx` (lub miejsce z przyciskiem usuń, sprawdzę): zastąpić natychmiastowe usuwanie przyciskiem "Zaplanuj usunięcie organizacji za 7 dni" (owner). Gdy `deletion_scheduled_for` ustawione — pokaż banner z datą i przyciskiem "Anuluj usunięcie" (owner).
- `src/routes/_authenticated.organizations.$orgId.tsx` (layout org): banner ostrzegawczy dla wszystkich członków gdy `deletion_scheduled_for IS NOT NULL` — informacja kto i kiedy zaplanował usunięcie, data finalna.
- (Opcjonalnie) lista powiadomień jeśli istnieje komponent `PendingInvitations`/notyfikacji — dorzucić obsługę typu `org_deletion_requested|cancelled`. Jeżeli nie ma globalnej dzwoneczka — wystarczy in-app banner + e-mail w drugiej iteracji.

## 4) i18n
Nowe klucze (`pl.ts`/`en.ts`):
- `organizations.members.invite_as_owner`, `..._help`, `..._only_owner_can_invite_owner`.
- `organizations.deletion.request`, `..._scheduled`, `..._cancel`, `..._banner`, `..._scheduled_for`.

## 5) Migracje do wykonania ręcznie
Użytkownik musi uruchomić w panelu Supabase:
- `0043_invitation_owner_role.sql`
- `0044_org_pending_deletion.sql`

## Pliki dotknięte
- `supabase/migrations/0043_invitation_owner_role.sql` (nowy)
- `supabase/migrations/0044_org_pending_deletion.sql` (nowy)
- `src/lib/organizations.functions.ts`
- `src/lib/invitations.functions.ts`
- `src/routes/_authenticated.organizations.$orgId.members.tsx`
- `src/routes/_authenticated.organizations.$orgId.profile.tsx` (lub sekcja delete — zweryfikuję podczas implementacji)
- `src/routes/_authenticated.organizations.$orgId.tsx` (banner)
- `src/routes/api/public/org-deletion-tick.ts` (nowy)
- `src/locales/pl.ts`, `src/locales/en.ts`

## Pytanie
Czy potrwierdzasz powyższy plan, czy chcesz coś zmienić (np. inny okres niż 7 dni, e-mail zamiast in-app banner, brak wymogu „tylko owner zaprasza ownera")?
