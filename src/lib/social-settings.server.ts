// Server-only helper: czyta globalne ustawienia social (limity crona) z tabeli app_settings,
// z cache w pamięci modułu (60s), żeby crony nie pytały DB 3x za każdym tickiem.
// Używać WYŁĄCZNIE wewnątrz server fn / server route handlers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SocialSettings = {
  syncInboxMaxPosts: number;
  syncInboxWindowDays: number;
  syncMetricsMaxPosts: number;
  syncMetricsWindowDays: number;
  importPerAccountLimit: number;
  importMaxAccounts: number;
  aiModerationMaxPerTick: number;
  aiModerationDailyBudgetCalls: number;
};

export const SOCIAL_SETTINGS_DEFAULTS: SocialSettings = {
  syncInboxMaxPosts: 200,
  syncInboxWindowDays: 30,
  syncMetricsMaxPosts: 200,
  syncMetricsWindowDays: 30,
  importPerAccountLimit: 25,
  importMaxAccounts: 500,
  aiModerationMaxPerTick: 20,
  aiModerationDailyBudgetCalls: 1000,
};

// Limity twarde — chronią aplikację przed katastrofalnymi ustawieniami administratora.
export const SOCIAL_SETTINGS_BOUNDS = {
  syncInboxMaxPosts: { min: 10, max: 2000 },
  syncInboxWindowDays: { min: 1, max: 90 },
  syncMetricsMaxPosts: { min: 10, max: 2000 },
  syncMetricsWindowDays: { min: 1, max: 90 },
  importPerAccountLimit: { min: 5, max: 200 },
  importMaxAccounts: { min: 50, max: 5000 },
  aiModerationMaxPerTick: { min: 1, max: 100 },
  aiModerationDailyBudgetCalls: { min: 0, max: 100_000 },
} as const;

const KEY_MAP: Array<[keyof SocialSettings, string]> = [
  ["syncInboxMaxPosts", "social.sync_inbox.max_posts"],
  ["syncInboxWindowDays", "social.sync_inbox.window_days"],
  ["syncMetricsMaxPosts", "social.sync_metrics.max_posts"],
  ["syncMetricsWindowDays", "social.sync_metrics.window_days"],
  ["importPerAccountLimit", "social.import_posts.per_account_limit"],
  ["importMaxAccounts", "social.import_posts.max_accounts"],
  ["aiModerationMaxPerTick", "social.ai_moderation.max_per_tick"],
  ["aiModerationDailyBudgetCalls", "social.ai_moderation.daily_budget_calls"],
];

export const SOCIAL_SETTINGS_KEYS: ReadonlyArray<string> = KEY_MAP.map(([, k]) => k);

let cache: { value: SocialSettings; expiresAt: number } | null = null;
const TTL_MS = 60_000;

function clampNumber(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.floor(v) : fallback;
}

export async function getSocialSettings(): Promise<SocialSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", SOCIAL_SETTINGS_KEYS as string[]);

  const map = new Map<string, unknown>();
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    map.set(row.key, row.value);
  }

  const out: SocialSettings = { ...SOCIAL_SETTINGS_DEFAULTS };
  for (const [field, key] of KEY_MAP) {
    if (map.has(key)) {
      out[field] = clampNumber(map.get(key), SOCIAL_SETTINGS_DEFAULTS[field]);
    }
  }

  cache = { value: out, expiresAt: Date.now() + TTL_MS };
  return out;
}

export function invalidateSocialSettingsCache(): void {
  cache = null;
}

export function settingKeyFor(field: keyof SocialSettings): string {
  const entry = KEY_MAP.find(([f]) => f === field);
  if (!entry) throw new Error(`Unknown social setting: ${String(field)}`);
  return entry[1];
}

// Helper: zapis wyniku ticku crona do social_sync_runs (best-effort, nie rzuca).
export type SyncRunMetrics = {
  job: "sync-inbox" | "sync-metrics" | "import-posts";
  startedAt: number;
  processed?: number;
  inserted?: number;
  ok?: number;
  fail?: number;
  skippedPermission?: number;
  skippedDisabled?: number;
  skippedBudget?: number;
  aiModerated?: number;
  errors?: Array<{ ref: string; message: string }>;
  notes?: string;
};

export async function recordSyncRun(m: SyncRunMetrics): Promise<void> {
  try {
    const finishedAt = new Date();
    const startedAtDate = new Date(m.startedAt);
    await supabaseAdmin.from("social_sync_runs").insert({
      job: m.job,
      started_at: startedAtDate.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - m.startedAt,
      processed: m.processed ?? 0,
      inserted: m.inserted ?? 0,
      ok_count: m.ok ?? 0,
      fail_count: m.fail ?? 0,
      skipped_permission: m.skippedPermission ?? 0,
      skipped_disabled: m.skippedDisabled ?? 0,
      skipped_budget: m.skippedBudget ?? 0,
      ai_moderated: m.aiModerated ?? 0,
      error_summary:
        m.errors && m.errors.length > 0 ? (m.errors.slice(0, 5) as unknown) : null,
      notes: m.notes ?? null,
    });
  } catch (e) {
    console.error("[recordSyncRun] failed", e);
  }
}
