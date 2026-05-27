import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cennik OpenAI per 1M tokenów (USD). Aktualizuj wg potrzeb.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-5":        { in: 1.25,  out: 10.00 },
  "gpt-5-mini":   { in: 0.25,  out: 2.00 },
  "gpt-5-nano":   { in: 0.05,  out: 0.40 },
  "gpt-4o":       { in: 2.50,  out: 10.00 },
  "gpt-4o-mini":  { in: 0.15,  out: 0.60 },
  "gpt-4.1":      { in: 2.00,  out: 8.00 },
  "gpt-4.1-mini": { in: 0.40,  out: 1.60 },
  "gpt-4.1-nano": { in: 0.10,  out: 0.40 },
  "o3-mini":      { in: 1.10,  out: 4.40 },
};

function calcCost(model: string, tIn: number, tOut: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (tIn / 1_000_000) * p.in + (tOut / 1_000_000) * p.out;
}

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!roles.some((r) => r === "super_admin" || r === "admin_staff")) {
    throw new Error("Forbidden");
  }
}

export type AiKonfiguracja = {
  id: number;
  provider: string;
  default_model: string;
  models: string[];
  scenariusz_model: Record<string, string>;
  monthly_limit_usd: number;
  enabled: boolean;
  system_prompt: string | null;
  temperature: number;
  max_tokens: number | null;
  updated_at: string;
};

export const getAiKonfiguracja = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiKonfiguracja | null> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabaseAdmin
      .from("ai_konfiguracja")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as AiKonfiguracja | null;
  });

export const updateAiKonfiguracja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        enabled: z.boolean(),
        default_model: z.string().min(1).max(60),
        models: z.array(z.string().min(1).max(60)).min(1).max(40),
        scenariusz_model: z.record(z.string().min(1).max(64), z.string().min(1).max(60)),
        monthly_limit_usd: z.number().min(0).max(1_000_000),
        system_prompt: z.string().max(4000).nullable().optional(),
        temperature: z.number().min(0).max(2),
        max_tokens: z.number().int().min(1).max(128000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (!data.models.includes(data.default_model)) {
      throw new Error("Domyślny model musi być na liście dostępnych modeli");
    }
    const { error } = await supabaseAdmin
      .from("ai_konfiguracja")
      .update({
        enabled: data.enabled,
        default_model: data.default_model,
        models: data.models,
        scenariusz_model: data.scenariusz_model,
        monthly_limit_usd: data.monthly_limit_usd,
        system_prompt: data.system_prompt ?? null,
        temperature: data.temperature,
        max_tokens: data.max_tokens ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AiUzycieRow = {
  id: number;
  user_id: string | null;
  user_email: string | null;
  scenariusz: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number | null;
  status: string;
  error: string | null;
  created_at: string;
};

export type AiUzycieStats = {
  rows: AiUzycieRow[];
  totalCost: number;
  totalCalls: number;
  totalErrors: number;
  byUser: Array<{ key: string; calls: number; cost: number }>;
  byScen: Array<{ key: string; calls: number; cost: number }>;
  byModel: Array<{ key: string; calls: number; cost: number }>;
};

export const getAiUzycieStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiUzycieStats> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
      .from("ai_uzycie")
      .select("*")
      .gte("created_at", startMonth.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as AiUzycieRow[];

    const byUser = new Map<string, { calls: number; cost: number }>();
    const byScen = new Map<string, { calls: number; cost: number }>();
    const byModel = new Map<string, { calls: number; cost: number }>();
    let totalCost = 0;
    let totalErrors = 0;
    for (const r of rows) {
      const cost = Number(r.cost_usd || 0);
      totalCost += cost;
      if (r.status !== "ok") totalErrors++;
      const u = r.user_email || r.user_id || "?";
      const cu = byUser.get(u) ?? { calls: 0, cost: 0 };
      cu.calls++; cu.cost += cost; byUser.set(u, cu);
      const cs = byScen.get(r.scenariusz) ?? { calls: 0, cost: 0 };
      cs.calls++; cs.cost += cost; byScen.set(r.scenariusz, cs);
      const cm = byModel.get(r.model) ?? { calls: 0, cost: 0 };
      cm.calls++; cm.cost += cost; byModel.set(r.model, cm);
    }
    const toArr = (m: Map<string, { calls: number; cost: number }>) =>
      Array.from(m.entries())
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.cost - a.cost);
    return {
      rows,
      totalCost,
      totalCalls: rows.length,
      totalErrors,
      byUser: toArr(byUser),
      byScen: toArr(byScen),
      byModel: toArr(byModel),
    };
  });

/**
 * Wywołanie OpenAI Chat Completions. Dostępne dla każdego zalogowanego usera.
 * Egzekwuje miesięczny limit (USD) i wybór modelu wg scenariusza.
 */
export const callAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["system", "user", "assistant"]),
              content: z.string().min(1).max(50_000),
            }),
          )
          .min(1)
          .max(50),
        scenariusz: z.string().min(1).max(64).default("inne"),
        model: z.string().min(1).max(60).optional(),
        max_tokens: z.number().int().min(1).max(128_000).optional(),
        response_format: z.unknown().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, userEmail } = context;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Brak OPENAI_API_KEY w konfiguracji serwera.");

    // 1) Konfiguracja
    const { data: konf } = await supabaseAdmin
      .from("ai_konfiguracja")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const cfg = (konf ?? {}) as Partial<AiKonfiguracja>;
    const enabled = cfg.enabled !== false;
    if (!enabled) throw new Error("Integracja AI jest wyłączona.");

    const monthlyLimit = Number(cfg.monthly_limit_usd ?? 50);
    const scenMap = (cfg.scenariusz_model ?? {}) as Record<string, string>;
    const defaultModel = cfg.default_model || "gpt-4o-mini";
    const model =
      data.model || scenMap[data.scenariusz] || defaultModel;

    // 2) Limit miesięczny
    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);
    const { data: used } = await supabaseAdmin
      .from("ai_uzycie")
      .select("cost_usd")
      .gte("created_at", startMonth.toISOString());
    const monthlyUsed = (used ?? []).reduce(
      (s, r) => s + Number((r as { cost_usd: number }).cost_usd || 0),
      0,
    );
    if (monthlyUsed >= monthlyLimit) {
      throw new Error(
        `Przekroczono miesięczny limit ${monthlyLimit} USD (wykorzystano ${monthlyUsed.toFixed(4)} USD).`,
      );
    }

    // 3) Wywołanie OpenAI
    const messages = cfg.system_prompt
      ? [{ role: "system" as const, content: cfg.system_prompt }, ...data.messages]
      : data.messages;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: cfg.temperature ?? 0.7,
    };
    const maxTok = data.max_tokens ?? cfg.max_tokens ?? null;
    if (maxTok) body.max_completion_tokens = maxTok;
    if (data.response_format) body.response_format = data.response_format;

    const startedAt = Date.now();
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const duration = Date.now() - startedAt;
    const text = await resp.text();
    let payload: {
      error?: { message?: string };
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: Array<{ message?: { content?: string } }>;
    } | null = null;
    try {
      payload = JSON.parse(text);
    } catch {
      // pomijamy
    }

    if (!resp.ok) {
      const errMsg =
        payload?.error?.message || text.slice(0, 500) || `OpenAI ${resp.status}`;
      await supabaseAdmin.from("ai_uzycie").insert({
        user_id: userId,
        user_email: userEmail,
        scenariusz: data.scenariusz,
        model,
        status: "error",
        error: errMsg.slice(0, 500),
        duration_ms: duration,
      });
      throw new Error(errMsg);
    }

    const tIn = Number(payload?.usage?.prompt_tokens ?? 0);
    const tOut = Number(payload?.usage?.completion_tokens ?? 0);
    const cost = calcCost(model, tIn, tOut);
    const content = payload?.choices?.[0]?.message?.content ?? "";

    await supabaseAdmin.from("ai_uzycie").insert({
      user_id: userId,
      user_email: userEmail,
      scenariusz: data.scenariusz,
      model,
      tokens_in: tIn,
      tokens_out: tOut,
      cost_usd: cost,
      duration_ms: duration,
      status: "ok",
    });

    return {
      content,
      model,
      tokens_in: tIn,
      tokens_out: tOut,
      cost_usd: cost,
      monthly_used: monthlyUsed + cost,
      monthly_limit: monthlyLimit,
    };
  });

/** Szybki test połączenia z OpenAI — tylko admin. */
export const pingAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Brak OPENAI_API_KEY w konfiguracji serwera.");
    const resp = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = (await resp.json()) as { data?: Array<{ id: string }> };
    return { ok: true, models_count: data.data?.length ?? 0 };
  });
