export const SUPABASE_PROJECT_URL = "https://rpnucwqjtnxfflwqpcgg.supabase.co";
export const SUPABASE_PROJECT_PUBLISHABLE_KEY = "sb_publishable_WE3e-T23sCNbMkCR0VrTlw_wdHzGzb-";

// UWAGA: aplikacja używa WYŁĄCZNIE zewnętrznego projektu Supabase
// (rpnucwqjtnxfflwqpcgg). Nie czytamy VITE_SUPABASE_* ani SUPABASE_URL z env,
// bo Lovable Cloud potrafi je nadpisać wartościami swojego zarządzanego
// projektu — wtedy logowanie w preview trafia do pustej bazy i zwraca
// "Invalid login credentials" dla każdego konta.
export function getSupabaseUrl(): string {
  return SUPABASE_PROJECT_URL;
}

export function getSupabasePublishableKey(): string {
  return SUPABASE_PROJECT_PUBLISHABLE_KEY;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
}