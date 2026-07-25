import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdeInboxRow = {
  id: string;
  from?: string;
  to?: string;
  subject?: string;
  receivedAt?: string;
  status?: string;
};

export type AdeInboxResult = {
  ok: boolean;
  items: AdeInboxRow[];
  mailbox: string;
  fetchedAt: string;
  error?: string;
  rawStatus?: number;
};

async function requireAdmin(ctx: { supabase: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: unknown; error: unknown }> } } }; userId: string }) {
  const { data, error } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error) throw new Error(`Nie udało się sprawdzić uprawnień: ${(error as Error).message ?? "błąd"}`);
  const roles = (data as { role: string }[] | null ?? []).map((r) => r.role);
  if (!roles.includes("super_admin") && !roles.includes("admin_staff")) throw new Error("Brak uprawnień administratora");
}

export const listAdeInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; page?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<AdeInboxResult> => {
    await requireAdmin(context);
    const { listAdeInboxRaw, normalizeInboxItems } = await import("@/lib/ade-inbox.server");
    const { loadAdeConfig } = await import("@/lib/ade-client.server");
    const cfg = loadAdeConfig();
    try {
      const res = await listAdeInboxRaw({ limit: data.limit ?? 50, page: data.page ?? 0 });
      if (res.status < 200 || res.status >= 300) {
        return {
          ok: false,
          items: [],
          mailbox: cfg.mailboxAddress,
          fetchedAt: new Date().toISOString(),
          error: `HTTP ${res.status}: ${res.body.slice(0, 300)}`,
          rawStatus: res.status,
        };
      }
      const items = normalizeInboxItems(res.json);
      return {
        ok: true,
        items,
        mailbox: cfg.mailboxAddress,
        fetchedAt: new Date().toISOString(),
        rawStatus: res.status,
      };
    } catch (err) {
      return {
        ok: false,
        items: [],
        mailbox: cfg.mailboxAddress,
        fetchedAt: new Date().toISOString(),
        error: (err as Error).message,
      };
    }
  });

export const getAdeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: boolean; body: string; error?: string; status?: number }> => {
    await requireAdmin(context);
    const { getAdeMessageRaw } = await import("@/lib/ade-inbox.server");
    try {
      const res = await getAdeMessageRaw(data.id);
      const ok = res.status >= 200 && res.status < 300;
      return { ok, body: res.body, status: res.status, error: ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, body: "", error: (err as Error).message };
    }
  });
