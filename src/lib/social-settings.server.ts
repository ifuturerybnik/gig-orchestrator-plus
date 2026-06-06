// Server-only helper: czyta globalne ustawienia social z app_settings z cache 60s
// + helper recordSyncRun do logowania ticków crona. Stałe i typy: social-settings.ts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SOCIAL_SETTINGS_DEFAULTS,
  SOCIAL_SETTINGS_KEY_MAP,
  SOCIAL_SETTINGS_KEYS,
  type SocialSettings,
} from "./social-settings";

export type { SocialSettings } from "./social-settings";

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
  for (const [field, key] of SOCIAL_SETTINGS_KEY_MAP) {
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
