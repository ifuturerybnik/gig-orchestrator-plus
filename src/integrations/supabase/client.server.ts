// SERVER-ONLY admin client. Uses service role key which bypasses RLS.
// Never import this from client code or shared isomorphic modules.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const serviceRoleKey = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error("Missing EXT_SUPABASE_SERVICE_ROLE_KEY runtime secret");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
