## Cel

Na dole dialogu **dodawania/edycji kontrahenta** oraz dialogu **dodawania/edycji kontaktu** pokazać listę „Moje organizacje" (te, w których jestem właścicielem/adminem/członkiem) z checkboxami. **Domyślnie wszystkie zaznaczone.** Po odznaczeniu danej organizacji wpis zostaje wyłącznie prywatny dla mnie.

## Logika (dwa różne modele danych)

### A. Kontrahenci — już mamy w schemacie

Tabela `counterparty_links` ma kolumny `owner_kind = 'user' | 'organization'` + `owner_user_id` / `owner_org_id`. Wystarczy tworzyć **dodatkowy wpis** w `counterparty_links` per każda zaznaczona organizacja (`owner_kind = 'organization'`).

To samo dla **powiązań kontakt ↔ kontrahent** (`contact_counterparty_links`) — w polityki RLS dla 'organization' już są w migracji 0022.

### B. Kontakty — potrzebny nowy mechanizm udostępniania

Tabela `contacts` jest single-owner (`owner_user_id` XOR `organization_id`). Żeby „ten sam kontakt" widoczny był też w organizacji, dodajemy nową tabelę `contact_org_shares (contact_id, organization_id)`.

To pozwala uniknąć duplikacji rekordu i utrzymać jeden „złoty" rekord kontaktu.

## Zmiany

### 1. Migracja DB — `supabase/migrations/0023_contact_org_shares.sql`

```sql
create table public.contact_org_shares (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contact_id, organization_id)
);

grant select, insert, delete on public.contact_org_shares to authenticated;
grant all on public.contact_org_shares to service_role;

alter table public.contact_org_shares enable row level security;

-- SELECT: właściciel kontaktu lub członek org, której kontakt jest udostępniony
create policy "shares_select" on public.contact_org_shares for select to authenticated
using (
  exists (select 1 from contacts c
          where c.id = contact_id and c.owner_user_id = auth.uid())
  or exists (select 1 from organization_members m
             where m.organization_id = contact_org_shares.organization_id
               and m.user_id = auth.uid())
);

-- INSERT: tylko właściciel kontaktu, do org której jest członkiem
create policy "shares_insert" on public.contact_org_shares for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (select 1 from contacts c
              where c.id = contact_id and c.owner_user_id = auth.uid())
  and exists (select 1 from organization_members m
              where m.organization_id = contact_org_shares.organization_id
                and m.user_id = auth.uid())
);

-- DELETE: właściciel kontaktu
create policy "shares_delete" on public.contact_org_shares for delete to authenticated
using (
  exists (select 1 from contacts c
          where c.id = contact_id and c.owner_user_id = auth.uid())
);
```

Aktualizacja widoczności w `useContacts` (tryb `org`): rozszerzyć zapytanie o kontakty udostępnione poprzez `contact_org_shares` (dwa zapytania + merge po stronie hooka, by uniknąć przebudowy SQL).

### 2. Nowy komponent — `src/components/pickers/MyOrgsShareSection.tsx`

Lista checkboxów moich organizacji (z `organization_members` gdzie `user_id = ja`). Props:
- `selectedOrgIds: string[]`
- `onChange(ids: string[])`
- `title` (override etykiety)
- `helpText`
- `defaultAllChecked?: boolean` (domyślnie `true` — przy pierwszym załadowaniu zaznacza wszystkie)

Jeśli user nie ma żadnej organizacji — sekcja się nie renderuje (cicha degradacja).

### 3. Server functions — `src/lib/org-sharing.functions.ts` (nowy)

- `listMyOrganizationsForSharing()` — zwraca `{ id, name }[]` org gdzie jestem członkiem
- `setCounterpartyOrgShares({ counterpartyOrgId, orgIds })` — synchronizuje `counterparty_links` (owner_kind='organization') do dokładnego zestawu `orgIds` (insert brakujących, delete nadmiarowych — tylko dla org, których user jest członkiem i które są przez niego utworzone/zarządzane)
- `setContactOrgShares({ contactId, orgIds })` — to samo dla `contact_org_shares`
- `getCounterpartyOrgShares({ counterpartyOrgId })` → `string[]` org ids
- `getContactOrgShares({ contactId })` → `string[]` org ids

### 4. UI — `AddCounterpartyDialog.tsx`

W kroku 2, nad/pod sekcją „Powiązane kontakty", wstawić `<MyOrgsShareSection />`. Domyślnie wszystkie zaznaczone. Po `addMutation`/`createDraft` (gdy mamy już `counterpartyOrgId`) → wywołać `setCounterpartyOrgShares({ counterpartyOrgId, orgIds })`. To samo w `CounterpartyDetailsDialog.tsx` (z prefetchem aktualnego stanu przez `getCounterpartyOrgShares`).

### 5. UI — `ContactForm.tsx`

Sekcja `<MyOrgsShareSection />` widoczna tylko gdy `scope.kind === 'user'`. Po `upsert.mutateAsync` → `setContactOrgShares({ contactId: saved.id, orgIds })`. W trybie edycji prefetch obecnych shares.

### 6. Drobne — i18n

Nowe klucze `sharing.my_orgs_title`, `sharing.my_orgs_help`, `sharing.no_orgs` w `src/locales/{pl,en}.ts`.

## Pliki

**Nowe**
- `supabase/migrations/0023_contact_org_shares.sql`
- `src/components/pickers/MyOrgsShareSection.tsx`
- `src/lib/org-sharing.functions.ts`

**Edytowane**
- `src/components/organizations/AddCounterpartyDialog.tsx`
- `src/components/organizations/CounterpartyDetailsDialog.tsx`
- `src/components/contacts/ContactForm.tsx`
- `src/hooks/useContacts.ts` (rozszerzenie listy o udostępnione)
- `src/locales/pl.ts`, `src/locales/en.ts`

## Uwagi

- Migracja 0023 wymaga ręcznego uruchomienia w panelu zewnętrznego Supabase.
- Domyślnie zaznaczone = przy nowym wpisie inicjujemy `selectedOrgIds = wszystkie moje org`. Przy edycji = `selectedOrgIds = aktualny stan z DB`.
- Odznaczenie wszystkich = wpis pozostaje wyłącznie prywatny (`owner_kind='user'`).
- Sekcja jest ukryta jeśli user nie ma żadnej swojej organizacji (sam siebie z `counterparty_links` nie excludujemy — przefiltruje to RLS i `listMyOrganizationsForSharing`).
