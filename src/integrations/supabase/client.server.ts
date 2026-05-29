// SERVER-ONLY admin client. Uses service role key which bypasses RLS.
// Never import this from client code or shared isomorphic modules.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const serviceRoleKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY as string;

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing EXT_SUPABASE_SERVICE_ROLE_KEY runtime secret");
  }

  cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAdmin;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
