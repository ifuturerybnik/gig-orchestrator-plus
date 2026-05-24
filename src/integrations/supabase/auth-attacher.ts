// Client-side function middleware: attaches the current Supabase access token
// as a Bearer header on every server-fn RPC call.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return next({ headers: { Authorization: `Bearer ${token}` } });
    }
    return next();
  }
);
