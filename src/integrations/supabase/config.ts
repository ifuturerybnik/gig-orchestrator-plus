export const SUPABASE_PROJECT_URL = "https://rpnucwqjtnxfflwqpcgg.supabase.co";
export const SUPABASE_PROJECT_PUBLISHABLE_KEY = "sb_publishable_WE3e-T23sCNbMkCR0VrTlw_wdHzGzb-";

export function getSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_PROJECT_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PROJECT_PUBLISHABLE_KEY
  );
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
}