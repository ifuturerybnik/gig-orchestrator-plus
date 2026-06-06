// Współdzielone typy i twarde limity ustawień social — bezpieczne do importu z UI i serwera.
// Logikę server-only (czytanie z DB, cache, recordSyncRun) trzyma social-settings.server.ts.

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

export const SOCIAL_SETTINGS_KEY_MAP: ReadonlyArray<readonly [keyof SocialSettings, string]> = [
  ["syncInboxMaxPosts", "social.sync_inbox.max_posts"],
  ["syncInboxWindowDays", "social.sync_inbox.window_days"],
  ["syncMetricsMaxPosts", "social.sync_metrics.max_posts"],
  ["syncMetricsWindowDays", "social.sync_metrics.window_days"],
  ["importPerAccountLimit", "social.import_posts.per_account_limit"],
  ["importMaxAccounts", "social.import_posts.max_accounts"],
  ["aiModerationMaxPerTick", "social.ai_moderation.max_per_tick"],
  ["aiModerationDailyBudgetCalls", "social.ai_moderation.daily_budget_calls"],
];

export const SOCIAL_SETTINGS_KEYS: ReadonlyArray<string> = SOCIAL_SETTINGS_KEY_MAP.map(
  ([, k]) => k,
);

export function settingKeyFor(field: keyof SocialSettings): string {
  const entry = SOCIAL_SETTINGS_KEY_MAP.find(([f]) => f === field);
  if (!entry) throw new Error(`Unknown social setting: ${String(field)}`);
  return entry[1];
}
