-- 0043_invitation_owner_role.sql
-- Umożliwia zapraszanie użytkownika od razu jako właściciel (owner) organizacji.
-- Tylko właściciele (lub super_admin/admin_staff) mogą wysyłać takie zaproszenie
-- (egzekwowane po stronie aplikacji w inviteUserToOrganization).

alter table public.organization_invitations
  add column if not exists initial_role text not null default 'member'
    check (initial_role in ('member','owner'));
