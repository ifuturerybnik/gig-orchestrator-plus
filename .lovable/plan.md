# Kontrola dostępu członków organizacji do modułów

## Zakres
Przy każdym członku (nie-właścicielu) na liście członków organizacji pojawi się ikona „Uprawnienia". Otwiera dialog konfiguracji:
- **Administrator organizacji** (wszystko, niezależnie od listy modułów), lub
- **Selektywny** — checkboxy modułów z sidebaru organizacji, z hierarchią dla grup (Korespondencja: Poczta / Autokorespondencja; Media i Web: AI Studio / Social / Web).
- Specjalne pole dla modułu **Budżet**: po zaznaczeniu pojawia się sub-wybór radio:
  - „Pełny dostęp" — bez ograniczeń,
  - „Tylko dodawanie pozycji niezrealizowanych" — może tworzyć wpisy (zawsze `completed=false`), nie może zmieniać statusu „Zrealizowano", widzi wszystko, może dodawać do tabeli „Przyszłe wydatki".

Właściciel (`role='owner'`) zawsze ma pełny dostęp — bez ikony edycji.
Administratorzy aplikacji (super_admin / admin_staff) jak dziś — widzą wszystko.

## Baza danych — `supabase/migrations/0040_member_permissions.sql`
Nowa tabela:
```sql
CREATE TABLE public.organization_member_permissions (
  member_id uuid PRIMARY KEY REFERENCES public.organization_members(id) ON DELETE CASCADE,
  is_org_admin boolean NOT NULL DEFAULT false,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,          -- np. ["events","budget","mail"]
  budget_mode text NOT NULL DEFAULT 'full'             -- 'full' | 'unrealized_only'
    CHECK (budget_mode IN ('full','unrealized_only')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_member_permissions TO authenticated;
GRANT ALL ON public.organization_member_permissions TO service_role;
ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;
```
RLS:
- SELECT: członek tej samej organizacji lub admin aplikacji,
- INSERT/UPDATE/DELETE: tylko owner danej organizacji lub admin aplikacji.

Funkcja pomocnicza (SECURITY DEFINER) `public.member_can_complete_budget(_user uuid, _org uuid) returns boolean` — używana w polityce update tabeli `organization_budget_entries`, żeby selektywny członek z `budget_mode='unrealized_only'` nie mógł zmienić `completed` z false na true (egzekwowane też w server fn).

Polityka update budżetu (`0009_budget_update_policy.sql`) — aktualizacja z dodatkowym `with check`: blokuje ustawienie `completed=true` dla takich członków. (Realizujemy poprzez nową policy + revoke poprzedniej.)

## Frontend

### 1. Wspólny katalog modułów — `src/lib/org-modules.ts`
Pojedyncze źródło prawdy: lista modułów + grupy + label keys (te same użyte w `OrgSidebar`). Importowane przez:
- `OrgSidebar` (filtrowanie pozycji wg uprawnień),
- dialog uprawnień,
- server fn dostępu.

```ts
export type OrgModuleId =
  | 'overview' | 'events' | 'budget' | 'profile'
  | 'contacts' | 'counterparties'
  | 'mail' | 'autokorespondencja'
  | 'ai_studio' | 'social' | 'web'
  | 'dysk' | 'members';
export const ORG_MODULES: Array<{ id: OrgModuleId; labelKey: string; group?: 'correspondence'|'media_web' }> = [...];
```

### 2. Server fns w `src/lib/organizations.functions.ts`
- `getMemberPermissions({ memberId })` — owner/admin app.
- `setMemberPermissions({ memberId, isOrgAdmin, modules, budgetMode })` — j.w.
- `getMyOrgPermissions({ organizationId })` — zwraca efektywne uprawnienia bieżącego usera (owner→all, app admin→all, członek→z tabeli; brak wpisu = brak dostępu poza overview/profile? — patrz pytanie poniżej, domyślnie: brak wpisu = pełny dostęp dla zgodności wstecznej).
- Rozszerzenie `getOrganizationDetails` o `myPermissions`.

### 3. UI lista członków — `src/routes/_authenticated.organizations.$orgId.members.tsx`
- Przy nie-ownerze (i gdy `canManage`) ikona `Settings2` → otwiera `<MemberPermissionsDialog>`.
- Dialog: switch „Administrator org" → wyłącza listę; lista checkboxów modułów (grupy zwijane), pod Budżet radio z trybem.

### 4. Sidebar — `src/components/org-sidebar.tsx`
- Pobiera `getMyOrgPermissions(orgId)`.
- Filtruje `items` przed renderem (overview/profile/members zawsze widoczne).

### 5. Budżet — `src/routes/_authenticated.organizations.$orgId.budget.tsx` + `planned-expenses-table`
- Czytuje `myPermissions`. Jeśli `budget_mode==='unrealized_only'`:
  - przy tworzeniu wpisu wymusza `completed=false` (pole UI ukryte/zablokowane),
  - checkbox „Zrealizowano" w tabeli renderowany jako disabled tooltip „Brak uprawnień".
- Server fn `setBudgetEntryCompleted` (lub odpowiednik) waliduje uprawnienie po stronie serwera — odrzuca zmianę.

## Reguła globalna do pamięci
Zapisuję `mem://design/org-modules-permissions`: każdy nowy moduł dodawany do `OrgSidebar` MUSI zostać dopisany do `ORG_MODULES` w `src/lib/org-modules.ts`, a w razie potrzeby do dialogu uprawnień. Aktualizuję też `mem://index.md` (Core).

## Pytania otwarte
1. **Brak wpisu uprawnień** dla starych członków: traktować jako (a) pełny dostęp do wszystkiego (kompatybilność wstecz), czy (b) brak dostępu poza Przegląd/Profil (bezpieczniej, ale wymusza skonfigurowanie wszystkich)?
2. Czy `members` (Członkowie) ma być modułem konfigurowalnym, czy zawsze widoczny tylko dla ownera/admina aplikacji (jak dziś — owner zarządza, członek nie widzi)?
3. `overview` / `profile` org — zawsze widoczne dla każdego członka czy też konfigurowalne?

Domyślnie przyjmę: 1=a (kompatybilność), 2=zawsze tylko owner/admin (nie konfigurowalne), 3=zawsze widoczne. Daj znać jeśli inaczej.
