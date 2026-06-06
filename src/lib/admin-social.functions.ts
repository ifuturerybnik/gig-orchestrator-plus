// Server functions dla panelu /admin/social — globalne limity i historia ticków.
// Wszystkie chronione guardem requireAdmin (super_admin lub admin_staff).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SOCIAL_SETTINGS_BOUNDS,
  SOCIAL_SETTINGS_DEFAULTS,
  SOCIAL_SETTINGS_KEYS,
  type SocialSettings,
  invalidateSocialSettingsCache,
  settingKeyFor,
} from "./social-settings.server";

async function requireAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  const ok = roles.includes("super_admin") || roles.includes("admin_staff");
  if (!ok) throw new Error("Forbidden: tylko administrator i-Future.");
}

export const getSocialAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SocialSettings> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", SOCIAL_SETTINGS_KEYS as string[]);
    const map = new Map<string, unknown>();
    for (const r of (data ?? []) as Array<{ key: string; value: unknown }>) {
      map.set(r.key, r.value);
    }
    const out: SocialSettings = { ...SOCIAL_SETTINGS_DEFAULTS };
    for (const field of Object.keys(SOCIAL_SETTINGS_DEFAULTS) as Array<keyof SocialSettings>) {
      const key = settingKeyFor(field);
      const v = map.get(key);
      if (typeof v === "number" && Number.isFinite(v)) out[field] = Math.floor(v);
    }
    return out;
  });

const updateSchema = z.object({
  syncInboxMaxPosts: z.number().int(),
  syncInboxWindowDays: z.number().int(),
  syncMetricsMaxPosts: z.number().int(),
  syncMetricsWindowDays: z.number().int(),
  importPerAccountLimit: z.number().int(),
  importMaxAccounts: z.number().int(),
  aiModerationMaxPerTick: z.number().int(),
  aiModerationDailyBudgetCalls: z.number().int(),
});

export const updateSocialAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Sprawdź twarde granice — nie pozwól adminowi wpisać destrukcyjnych wartości.
    for (const field of Object.keys(updateSchema.shape) as Array<keyof SocialSettings>) {
      const v = data[field];
      const b = SOCIAL_SETTINGS_BOUNDS[field];
      if (v < b.min || v > b.max) {
        throw new Error(
          `Wartość ${field} = ${v} jest poza dopuszczalnym zakresem [${b.min}, ${b.max}].`,
        );
      }
    }

    const rows = (Object.keys(updateSchema.shape) as Array<keyof SocialSettings>).map(
      (field) => ({
        key: settingKeyFor(field),
        value: data[field] as unknown as object,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      }),
    );
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    invalidateSocialSettingsCache();
    return { ok: true };
  });

export type SyncRunRow = {
  id: string;
  job: "sync-inbox" | "sync-metrics" | "import-posts";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  processed: number;
  inserted: number;
  ok_count: number;
  fail_count: number;
  skipped_permission: number;
  skipped_disabled: number;
  skipped_budget: number;
  ai_moderated: number;
  error_summary: Array<{ ref: string; message: string }> | null;
  notes: string | null;
};

export const listSocialSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        job: z.enum(["sync-inbox", "sync-metrics", "import-posts"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ rows: SyncRunRow[] }> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("social_sync_runs")
      .select(
        "id, job, started_at, finished_at, duration_ms, processed, inserted, ok_count, fail_count, skipped_permission, skipped_disabled, skipped_budget, ai_moderated, error_summary, notes",
      )
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (data.job) q = q.eq("job", data.job);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as unknown as SyncRunRow[] };
  });
