-- Preferowana strona, na którą użytkownik ma być przekierowany po zalogowaniu.
-- Pełna ścieżka URL (np. "/profile" lub "/organizations/<uuid>/events").
-- NULL = domyślnie /dashboard.

alter table public.profiles
  add column if not exists landing_path text;

alter table public.profiles
  drop constraint if exists profiles_landing_path_format;

alter table public.profiles
  add constraint profiles_landing_path_format
  check (
    landing_path is null
    or (length(landing_path) <= 300 and landing_path ~ '^/[A-Za-z0-9/_-]*$')
  );
