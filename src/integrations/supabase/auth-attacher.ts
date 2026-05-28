// Client-side function middleware: attaches the current Supabase access token
// as a Bearer header on every server-fn RPC call.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") {
      return next();
    }

    const { data } = await supabase.auth.getSession();
    let session = data.session;

    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
    const shouldRefresh = !!session && expiresAtMs - Date.now() < 60_000;

    if (shouldRefresh) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session ?? session;
    }

    const token = session?.access_token;
    if (token) {
      return next({ headers: { Authorization: `Bearer ${token}` } });
    }
    return next();
  },
);
