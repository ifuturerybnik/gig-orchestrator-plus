import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Typy / stałe ----------

const PLATFORM_IDS = [
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "twitter",
  "tiktok",
  "spotify_artists",
] as const;
const platformSchema = z.enum(PLATFORM_IDS);

export type SocialAccountRow = {
  id: string;
  organization_id: string;
  platform: string;
  external_account_id: string;
  account_name: string;
  account_avatar_url: string | null;
  scopes: string[];
  token_expires_at: string | null;
  last_sync_at: string | null;
  status: string;
  last_error: string | null;
  connected_by: string;
  connected_at: string;
  updated_at: string;
};

export type SocialPostRow = {
  id: string;
  organization_id: string;
  created_by: string;
  target_platforms: string[];
  content_per_platform: Record<string, { text?: string; hashtags?: string[]; media_urls?: string[] }>;
  linked_event_id: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  ai_generated: boolean;
  ai_scenariusz: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  // Enriched (z social_post_results / social_post_metrics / social_comments)
  results: Array<{
    platform: string;
    external_post_id: string | null;
    external_url: string | null;
    status: string;
  }>;
  metrics: { likes: number; comments: number; shares: number; views: number } | null;
  comment_counts: { total: number; new: number };
};


// ---------- Listing kont ----------

export const listSocialAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: SocialAccountRow[] }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("social_accounts")
      .select(
        "id, organization_id, platform, external_account_id, account_name, account_avatar_url, scopes, token_expires_at, last_sync_at, status, last_error, connected_by, connected_at, updated_at",
      )
      .eq("organization_id", data.organizationId)
      .order("connected_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as SocialAccountRow[] };
  });

export const disconnectSocialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        accountId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("social_accounts")
      .delete()
      .eq("id", data.accountId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Wizard: sprawdzenie gotowości platformy (per-organizacja) ----------
// Każda organizacja konfiguruje WŁASNĄ aplikację developerską u dostawcy
// (np. developer.x.com). Client ID + zaszyfrowany Client Secret żyją w
// public.social_app_credentials (RLS: tylko członkowie organizacji).

export const checkPlatformReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        platform: platformSchema,
        organizationId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const candidates = credPlatformCandidates(data.platform);
    const { data: rows, error } = await supabase
      .from("social_app_credentials")
      .select("id, client_id, configured_at, platform")
      .eq("organization_id", data.organizationId)
      .in("platform", candidates);

    if (error) throw new Error(error.message);
    const r =
      ((rows ?? []).find((x) => x.platform === credPlatform(data.platform)) ??
        (rows ?? [])[0]) as
        | null
        | { id: string; client_id: string; configured_at: string };
    return {
      platform: data.platform,
      hasClientId: !!r,
      clientIdMasked: r ? maskClientId(r.client_id) : null,
      configuredAt: r?.configured_at ?? null,
    };
  });


function maskClientId(s: string): string {
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
}

// Meta: Instagram dzieli aplikację z Facebookiem — credentials zapisujemy
// zawsze pod platformą "facebook", niezależnie od karty w UI.
function credPlatform(p: string): string {
  return p === "instagram" ? "facebook" : p;
}
function credPlatformCandidates(p: string): string[] {
  return p === "instagram" || p === "facebook"
    ? ["facebook", "instagram"]
    : [p];
}



// ---------- Posty: CRUD ----------

const contentSchema = z.record(
  z.string().min(1).max(40),
  z.object({
    text: z.string().max(64000).optional(),
    hashtags: z.array(z.string().max(60)).max(50).optional(),
    media_urls: z.array(z.string().url().max(2000)).max(20).optional(),
  }),
);

const createPostInput = z.object({
  organizationId: z.string().uuid(),
  targetPlatforms: z.array(platformSchema).min(1).max(10),
  contentPerPlatform: contentSchema,
  linkedEventId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  aiGenerated: z.boolean().optional(),
  aiScenariusz: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        status: z
          .enum(["draft", "scheduled", "publishing", "published", "failed", "cancelled"])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: SocialPostRow[] }> => {
    const { supabase } = context;
    let q = supabase
      .from("social_posts")
      .select(
        "id, organization_id, created_by, target_platforms, content_per_platform, linked_event_id, status, scheduled_at, published_at, ai_generated, ai_scenariusz, notes, source, created_at, updated_at",
      )
      .eq("organization_id", data.organizationId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const baseRows = (rows ?? []) as Array<Omit<SocialPostRow, "results" | "metrics" | "comment_counts">>;
    if (baseRows.length === 0) return { items: [] };
    const postIds = baseRows.map((r) => r.id);

    const [resultsRes, metricsRes, commentsRes] = await Promise.all([
      supabase
        .from("social_post_results")
        .select("post_id, platform, external_post_id, external_url, status")
        .in("post_id", postIds),
      supabase
        .from("social_post_metrics")
        .select("post_id, platform, likes, comments, shares, views, snapshot_at")
        .in("post_id", postIds)
        .order("snapshot_at", { ascending: false }),

      supabase
        .from("social_comments")
        .select("post_id, status")
        .in("post_id", postIds),
    ]);
    if (resultsRes.error) throw new Error(resultsRes.error.message);
    if (metricsRes.error) throw new Error(metricsRes.error.message);
    if (commentsRes.error) throw new Error(commentsRes.error.message);

    const resultsByPost = new Map<string, SocialPostRow["results"]>();
    for (const r of (resultsRes.data ?? []) as Array<{
      post_id: string; platform: string; external_post_id: string | null; external_url: string | null; status: string;
    }>) {
      const arr = resultsByPost.get(r.post_id) ?? [];
      arr.push({ platform: r.platform, external_post_id: r.external_post_id, external_url: r.external_url, status: r.status });
      resultsByPost.set(r.post_id, arr);
    }

    // Najnowsza metryka per post (sumujemy po platformach jednego posta)
    const latestByPost = new Map<string, { likes: number; comments: number; shares: number; views: number }>();
    const seenPlatform = new Map<string, Set<string>>(); // post_id -> set platforms
    for (const m of (metricsRes.data ?? []) as Array<{
      post_id: string; likes: number; comments: number; shares: number; views: number;
    }> & Array<{ platform?: string }>) {
      const pid = m.post_id;
      // pierwszy wpis dla danej platformy w obrębie posta = najnowszy
      const seen = seenPlatform.get(pid) ?? new Set<string>();
      const platformKey = (m as { platform?: string }).platform ?? "_";
      if (seen.has(platformKey)) continue;
      seen.add(platformKey);
      seenPlatform.set(pid, seen);
      const cur = latestByPost.get(pid) ?? { likes: 0, comments: 0, shares: 0, views: 0 };
      cur.likes += m.likes ?? 0;
      cur.comments += m.comments ?? 0;
      cur.shares += m.shares ?? 0;
      cur.views += m.views ?? 0;
      latestByPost.set(pid, cur);
    }

    const commentsByPost = new Map<string, { total: number; new: number }>();
    for (const c of (commentsRes.data ?? []) as Array<{ post_id: string; status: string }>) {
      const cur = commentsByPost.get(c.post_id) ?? { total: 0, new: 0 };
      cur.total++;
      if (c.status === "new") cur.new++;
      commentsByPost.set(c.post_id, cur);
    }

    const items: SocialPostRow[] = baseRows.map((r) => ({
      ...r,
      results: resultsByPost.get(r.id) ?? [],
      metrics: latestByPost.get(r.id) ?? null,
      comment_counts: commentsByPost.get(r.id) ?? { total: 0, new: 0 },
    }));
    return { items };
  });


export const createSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createPostInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const status =
      data.status === "scheduled" && data.scheduledAt ? "scheduled" : "draft";
    const { data: row, error } = await supabase
      .from("social_posts")
      .insert({
        organization_id: data.organizationId,
        created_by: userId,
        target_platforms: data.targetPlatforms,
        content_per_platform: data.contentPerPlatform,
        linked_event_id: data.linkedEventId ?? null,
        scheduled_at: data.scheduledAt ?? null,
        status,
        ai_generated: data.aiGenerated ?? false,
        ai_scenariusz: data.aiScenariusz ?? null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    createPostInput
      .extend({ postId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const status =
      data.status === "scheduled" && data.scheduledAt ? "scheduled" : "draft";
    const { error } = await supabase
      .from("social_posts")
      .update({
        target_platforms: data.targetPlatforms,
        content_per_platform: data.contentPerPlatform,
        linked_event_id: data.linkedEventId ?? null,
        scheduled_at: data.scheduledAt ?? null,
        status,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.postId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        postId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: post, error: accessErr } = await supabase
      .from("social_posts")
      .select("id, source")
      .eq("id", data.postId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (accessErr) throw new Error(accessErr.message);
    if (!post) throw new Error("Post nie istnieje lub brak dostępu.");
    if ((post as { source?: string }).source !== "imported") {
      const { error } = await supabase
        .from("social_posts")
        .delete()
        .eq("id", data.postId)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error: commentsErr } = await supabaseAdmin
      .from("social_comments")
      .delete()
      .eq("post_id", data.postId)
      .eq("organization_id", data.organizationId);
    if (commentsErr) throw new Error(commentsErr.message);

    const { error } = await supabaseAdmin
      .from("social_posts")
      .delete()
      .eq("id", data.postId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteImportedSocialPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: membership, error: membershipErr } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", data.organizationId)
      .limit(1)
      .maybeSingle();
    if (membershipErr) throw new Error(membershipErr.message);
    if (!membership) throw new Error("Brak dostępu do organizacji.");

    let q = supabaseAdmin
      .from("social_posts")
      .select("id, target_platforms")
      .eq("organization_id", data.organizationId)
      .eq("source", "imported")
      .limit(1000);
    if (data.platform) q = q.contains("target_platforms", [data.platform]);

    const { data: rows, error: listErr } = await q;
    if (listErr) throw new Error(listErr.message);
    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return { deleted: 0 };

    const { error: commentsErr } = await supabaseAdmin
      .from("social_comments")
      .delete()
      .eq("organization_id", data.organizationId)
      .in("post_id", ids);
    if (commentsErr) throw new Error(commentsErr.message);

    const { error: deleteErr } = await supabaseAdmin
      .from("social_posts")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("source", "imported")
      .in("id", ids);
    if (deleteErr) throw new Error(deleteErr.message);
    return { deleted: ids.length };
  });

// ---------- AI: generatory postów ----------

const PLATFORM_AI_HINTS: Record<string, string> = {
  facebook:
    "Facebook: post 80-300 słów, ciepły konwersacyjny ton, 0-3 hashtagi, emoji ok, opis korzyści i wezwanie do działania na końcu.",
  instagram:
    "Instagram: 50-150 słów, dużo emoji, 15-25 trafnych hashtagów na końcu, atrakcyjny pierwszy wiersz, hook.",
  youtube:
    "YouTube (opis filmu): 100-300 słów, opis treści, timestampy jeśli pasują, linki do social mediów, 3-8 hashtagów po opisie.",
  linkedin:
    "LinkedIn: 100-250 słów, profesjonalny ale ludzki ton, akapity 1-2 zdania, story-format, 3-5 hashtagów profesjonalnych.",
  twitter: "Twitter/X: MAKSYMALNIE 280 znaków razem z hashtagami. Treściwie, hook, 1-2 hashtagi.",
  tiktok:
    "TikTok (opis): 50-150 znaków, hook, 3-5 hashtagów trendowych, mocno emocjonalny i krótki.",
  spotify_artists: "Spotify Artists nie obsługuje publikacji postów — pomiń.",
};

function buildEventContext(args: {
  name: string;
  date: string;
  city?: string | null;
  street?: string | null;
  notes?: string | null;
  artists?: string[];
  eventKind?: string | null;
}): string {
  const lines: string[] = [`Nazwa wydarzenia: ${args.name}`, `Data: ${args.date}`];
  if (args.eventKind) lines.push(`Rodzaj: ${args.eventKind}`);
  if (args.city) lines.push(`Miasto: ${args.city}`);
  if (args.street) lines.push(`Adres: ${args.street}`);
  if (args.artists?.length) lines.push(`Artyści/wykonawcy: ${args.artists.join(", ")}`);
  if (args.notes) lines.push(`Dodatkowe notatki: ${args.notes}`);
  return lines.join("\n");
}

async function callAiInternal(args: {
  userId: string;
  userEmail: string | null;
  scenariusz: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Brak OPENAI_API_KEY w konfiguracji serwera.");

  const { data: konf } = await supabaseAdmin
    .from("ai_konfiguracja")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  type Cfg = {
    enabled?: boolean;
    monthly_limit_usd?: number;
    scenariusz_model?: Record<string, string>;
    default_model?: string;
    system_prompt?: string | null;
    temperature?: number;
    max_tokens?: number | null;
  };
  const cfg = (konf ?? {}) as Cfg;
  if (cfg.enabled === false) throw new Error("Integracja AI jest wyłączona przez administratora.");

  const monthlyLimit = Number(cfg.monthly_limit_usd ?? 50);
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
      `Przekroczono miesięczny limit AI ${monthlyLimit} USD (wykorzystano ${monthlyUsed.toFixed(4)} USD).`,
    );
  }

  const scenMap = cfg.scenariusz_model ?? {};
  const model =
    scenMap[args.scenariusz] || cfg.default_model || "gpt-4o-mini";

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (cfg.system_prompt) messages.push({ role: "system", content: cfg.system_prompt });
  messages.push({ role: "system", content: args.systemPrompt });
  messages.push({ role: "user", content: args.userPrompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: cfg.temperature ?? 0.7,
  };
  const maxTok = args.maxTokens ?? cfg.max_tokens ?? 1500;
  if (maxTok) body.max_completion_tokens = maxTok;

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
    // ignore
  }

  if (!resp.ok) {
    const errMsg = payload?.error?.message || text.slice(0, 300) || `OpenAI ${resp.status}`;
    await supabaseAdmin.from("ai_uzycie").insert({
      user_id: args.userId,
      user_email: args.userEmail,
      scenariusz: args.scenariusz,
      model,
      status: "error",
      error: errMsg.slice(0, 500),
      duration_ms: duration,
    });
    throw new Error(errMsg);
  }

  const tIn = Number(payload?.usage?.prompt_tokens ?? 0);
  const tOut = Number(payload?.usage?.completion_tokens ?? 0);
  const PRICING: Record<string, { in: number; out: number }> = {
    "gpt-5": { in: 1.25, out: 10 },
    "gpt-5-mini": { in: 0.25, out: 2 },
    "gpt-5-nano": { in: 0.05, out: 0.4 },
    "gpt-4o": { in: 2.5, out: 10 },
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "gpt-4.1": { in: 2, out: 8 },
    "gpt-4.1-mini": { in: 0.4, out: 1.6 },
    "gpt-4.1-nano": { in: 0.1, out: 0.4 },
    "o3-mini": { in: 1.1, out: 4.4 },
  };
  const p = PRICING[model];
  const cost = p ? (tIn / 1_000_000) * p.in + (tOut / 1_000_000) * p.out : 0;

  await supabaseAdmin.from("ai_uzycie").insert({
    user_id: args.userId,
    user_email: args.userEmail,
    scenariusz: args.scenariusz,
    model,
    tokens_in: tIn,
    tokens_out: tOut,
    cost_usd: cost,
    duration_ms: duration,
    status: "ok",
  });

  return payload?.choices?.[0]?.message?.content ?? "";
}

/**
 * AI: wygeneruj post(y) dla wybranych platform — z opcjonalnym kontekstem wydarzenia
 * lub z dowolnego promptu użytkownika.
 */
export const aiGenerateSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platforms: z.array(platformSchema).min(1).max(7),
        eventId: z.string().uuid().nullable().optional(),
        prompt: z.string().max(4000).optional(),
        tone: z.enum(["informational", "promotional", "celebratory", "behind_the_scenes"]).optional(),
        language: z.enum(["pl", "en"]).default("pl"),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      perPlatform: Record<string, { text: string; hashtags: string[] }>;
      bestTimeHint: string | null;
    }> => {
      const { supabase, userId, userEmail } = context;

      // Kontekst wydarzenia jeśli przekazany
      let eventCtx: string | null = null;
      if (data.eventId) {
        const { data: perf, error: pErr } = await supabase
          .from("performances")
          .select(
            "id, name, performance_date, event_kind, city, street, street_number, notes",
          )
          .eq("id", data.eventId)
          .maybeSingle();
        if (pErr) throw new Error(pErr.message);
        if (perf) {
          const { data: ass } = await supabase
            .from("performance_assignments")
            .select("contact_id, counterparty_id")
            .eq("performance_id", data.eventId);
          const contactIds = (ass ?? [])
            .map((a) => (a as { contact_id: string | null }).contact_id)
            .filter(Boolean) as string[];
          const cpIds = (ass ?? [])
            .map((a) => (a as { counterparty_id: string | null }).counterparty_id)
            .filter(Boolean) as string[];
          const [cRes, oRes] = await Promise.all([
            contactIds.length
              ? supabase.from("contacts").select("id, display_name").in("id", contactIds)
              : Promise.resolve({ data: [] }),
            cpIds.length
              ? supabaseAdmin.from("organizations").select("id, name").in("id", cpIds)
              : Promise.resolve({ data: [] }),
          ]);
          const artists = [
            ...((cRes.data ?? []) as Array<{ display_name: string }>).map((c) => c.display_name),
            ...((oRes.data ?? []) as Array<{ name: string }>).map((o) => o.name),
          ];
          const p = perf as {
            name: string;
            performance_date: string;
            event_kind: string | null;
            city: string | null;
            street: string | null;
            street_number: string | null;
            notes: string | null;
          };
          eventCtx = buildEventContext({
            name: p.name,
            date: p.performance_date,
            city: p.city,
            street: [p.street, p.street_number].filter(Boolean).join(" ") || null,
            notes: p.notes,
            artists,
            eventKind: p.event_kind,
          });
        }
      }

      const platformHints = data.platforms
        .map((id) => `- ${id.toUpperCase()}: ${PLATFORM_AI_HINTS[id] ?? ""}`)
        .join("\n");

      const langName = data.language === "pl" ? "polski" : "angielski";
      const toneText =
        {
          informational: "informacyjny, neutralny",
          promotional: "promocyjny, zachęcający do zakupu biletów",
          celebratory: "świąteczny, świętujący osiągnięcie",
          behind_the_scenes: "kulisowy, pokazujący proces przygotowań",
        }[data.tone ?? "promotional"];

      const userPrompt = [
        eventCtx ? `Kontekst wydarzenia:\n${eventCtx}\n` : null,
        data.prompt ? `Dodatkowe wytyczne od użytkownika:\n${data.prompt}` : null,
        `Wygeneruj posty w języku: ${langName}.`,
        `Ton: ${toneText}.`,
        `Wymagane platformy i ich zasady:`,
        platformHints,
        `\nZwróć WYŁĄCZNIE poprawny JSON w formacie:`,
        `{ "platforms": { "<platform_id>": { "text": "...", "hashtags": ["...","..."] } }, "best_time_hint": "..." }`,
        `Nie dodawaj żadnego tekstu poza JSON. "best_time_hint" to krótka sugestia kiedy publikować (np. "wtorek 18:00").`,
      ]
        .filter(Boolean)
        .join("\n");

      const systemPrompt =
        "Jesteś doświadczonym specjalistą social media menadżerem dla branży eventowej/koncertowej. Tworzysz angażujące, autentyczne posty dostosowane do specyfiki każdej platformy. Zwracasz dane WYŁĄCZNIE jako poprawny JSON.";

      const raw = await callAiInternal({
        userId,
        userEmail,
        scenariusz: data.eventId
          ? "social_post_from_event"
          : data.platforms.length > 1
            ? "social_post_adapt_platforms"
            : "social_post_from_prompt",
        systemPrompt,
        userPrompt,
        maxTokens: 2000,
      });

      // Parsuj JSON (z tolerancją na ```json bloki)
      let cleaned = raw.trim();
      const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) cleaned = fence[1].trim();
      let parsed: {
        platforms?: Record<string, { text?: string; hashtags?: string[] }>;
        best_time_hint?: string;
      };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(
          "AI zwróciła odpowiedź w nieprawidłowym formacie. Spróbuj ponownie lub zmień prompt.",
        );
      }

      const perPlatform: Record<string, { text: string; hashtags: string[] }> = {};
      for (const pid of data.platforms) {
        const p = parsed.platforms?.[pid];
        if (p && typeof p.text === "string") {
          perPlatform[pid] = {
            text: p.text,
            hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 50) : [],
          };
        }
      }
      return {
        perPlatform,
        bestTimeHint: parsed.best_time_hint ?? null,
      };
    },
  );

/**
 * AI: analiza engagement na podstawie zebranych statystyk postów.
 */
export const aiAnalyzeEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ summary: string }> => {
    const { supabase, userId, userEmail } = context;

    const { data: posts } = await supabase
      .from("social_posts")
      .select("id, target_platforms, status, published_at")
      .eq("organization_id", data.organizationId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    const postIds = (posts ?? []).map((p) => (p as { id: string }).id);

    let metricsRows: Array<{
      post_id: string;
      platform: string;
      likes: number;
      comments: number;
      shares: number;
      views: number;
    }> = [];
    if (postIds.length) {
      const { data: m } = await supabase
        .from("social_post_metrics")
        .select("post_id, platform, likes, comments, shares, views")
        .in("post_id", postIds);
      metricsRows = (m ?? []) as typeof metricsRows;
    }

    if (metricsRows.length === 0) {
      return {
        summary:
          "Brak danych statystycznych do analizy. Statystyki pojawią się po podłączeniu kont SM i opublikowaniu pierwszych postów.",
      };
    }

    const aggByPlatform: Record<
      string,
      { likes: number; comments: number; shares: number; views: number; count: number }
    > = {};
    for (const r of metricsRows) {
      const agg = aggByPlatform[r.platform] ?? {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        count: 0,
      };
      agg.likes += r.likes;
      agg.comments += r.comments;
      agg.shares += r.shares;
      agg.views += r.views;
      agg.count += 1;
      aggByPlatform[r.platform] = agg;
    }

    const userPrompt = `Statystyki postów organizacji (zsumowane per platforma):\n${JSON.stringify(
      aggByPlatform,
      null,
      2,
    )}\n\nWykonaj krótką analizę (max 250 słów): co działa lepiej, co warto zmienić, kiedy publikować, jakie formaty rozwijać.`;

    const summary = await callAiInternal({
      userId,
      userEmail,
      scenariusz: "social_engagement_analysis",
      systemPrompt:
        "Jesteś analitykiem mediów społecznościowych. Tworzysz zwięzłe, praktyczne raporty z konkretnych liczb.",
      userPrompt,
      maxTokens: 800,
    });

    return { summary };
  });

// ============================================================================
// Skrzynka / Moderacja
// ============================================================================

export type InboxCommentRow = {
  id: string;
  organization_id: string;
  account_id: string;
  platform: string;
  post_id: string | null;
  external_post_id: string;
  external_comment_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  content: string;
  permalink: string | null;
  posted_at: string | null;
  status: string;
  ai_sentiment: string | null;
  ai_flags: string[];
  ai_suggested_reply: string | null;
  like_count: number;
  reply_count: number;
};

export const listInboxComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        status: z
          .enum(["new", "replied", "hidden", "deleted", "spam", "archived", "all"])
          .default("new"),
        platform: platformSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: InboxCommentRow[] }> => {
    const { supabase } = context;
    let q = supabase
      .from("social_comments")
      .select(
        "id, organization_id, account_id, platform, post_id, external_post_id, external_comment_id, author_name, author_avatar_url, content, permalink, posted_at, status, ai_sentiment, ai_flags, ai_suggested_reply, like_count, reply_count",
      )
      .eq("organization_id", data.organizationId)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.platform) q = q.eq("platform", data.platform);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as InboxCommentRow[] };
  });

export const getInboxCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("social_comments")
      .select("status")
      .eq("organization_id", data.organizationId);
    const counts: Record<string, number> = { new: 0, replied: 0, hidden: 0, spam: 0, total: 0 };
    for (const r of (rows ?? []) as Array<{ status: string }>) {
      counts.total++;
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  });

export const moderateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        commentId: z.string().uuid(),
        action: z.enum(["hide", "unhide", "delete", "mark_spam", "archive"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const statusByAction: Record<string, string> = {
      hide: "hidden",
      unhide: "new",
      delete: "deleted",
      mark_spam: "spam",
      archive: "archived",
    };
    const { error } = await supabase
      .from("social_comments")
      .update({
        status: statusByAction[data.action],
        handled_by: userId,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.commentId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await supabase.from("social_moderation_log").insert({
      organization_id: data.organizationId,
      comment_id: data.commentId,
      action: data.action,
      result: "ok",
      performed_by: userId,
    });
    return { ok: true };
  });

export const replyToComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        commentId: z.string().uuid(),
        text: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pobierz komentarz + info o platformie/posta źródłowego
    const { data: c, error: cErr } = await supabase
      .from("social_comments")
      .select(
        "id, platform, external_post_id, external_comment_id, account_id, organization_id",
      )
      .eq("id", data.commentId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Komentarz nie istnieje.");
    const cm = c as {
      id: string;
      platform: string;
      external_post_id: string;
      external_comment_id: string;
      account_id: string;
      organization_id: string;
    };

    // Spróbuj wysłać do platformy (jeśli mamy adapter z reply())
    let sentExternalId: string | null = null;
    let sendError: string | null = null;
    try {
      const { getAdapter, getValidAccount } = await import("./platforms/index.server");
      const adapter = getAdapter(cm.platform);
      if (adapter?.reply) {
        const ctx2 = await getValidAccount({
          organizationId: cm.organization_id,
          platform: cm.platform,
        });
        if (!ctx2) throw new Error("Brak podłączonego konta tej platformy.");
        const r = await adapter.reply({
          account: ctx2.account,
          externalParentCommentId: cm.external_comment_id,
          externalPostId: cm.external_post_id,
          text: data.text,
          clientId: ctx2.credentials.clientId,
          clientSecret: ctx2.credentials.clientSecret,
        });
        sentExternalId = r.externalCommentId;
      } else {
        sendError = `Wysyłka odpowiedzi do ${cm.platform} nie jest jeszcze aktywna.`;
      }
    } catch (e) {
      sendError = e instanceof Error ? e.message : String(e);
    }

    // Oznacz komentarz jako 'replied' (zawsze — UX: widzimy że obsłużone)
    const { error: updErr } = await supabase
      .from("social_comments")
      .update({
        status: "replied",
        handled_by: userId,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.commentId)
      .eq("organization_id", data.organizationId);
    if (updErr) throw new Error(updErr.message);

    await supabase.from("social_moderation_log").insert({
      organization_id: data.organizationId,
      comment_id: data.commentId,
      action: "reply",
      payload: { text: data.text, external_id: sentExternalId },
      result: sendError ? "pending_oauth" : "ok",
      error_message: sendError,
      performed_by: userId,
    });
    return { ok: true, sent: !!sentExternalId, error: sendError };
  });

export const aiSuggestCommentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        commentId: z.string().uuid(),
        tone: z.enum(["warm", "formal", "short"]).default("warm"),
        language: z.enum(["pl", "en"]).default("pl"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ variants: string[] }> => {
    const { supabase, userId, userEmail } = context;
    const { data: c, error } = await supabase
      .from("social_comments")
      .select("id, content, platform, author_name, post_id")
      .eq("id", data.commentId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Komentarz nie istnieje.");

    let postCtx = "";
    const cm = c as { id: string; content: string; platform: string; author_name: string | null; post_id: string | null };
    if (cm.post_id) {
      const { data: post } = await supabase
        .from("social_posts")
        .select("content_per_platform")
        .eq("id", cm.post_id)
        .maybeSingle();
      const cpp = (post as { content_per_platform?: Record<string, { text?: string }> } | null)?.content_per_platform;
      if (cpp) {
        postCtx = Object.values(cpp)[0]?.text ?? "";
      }
    }

    const toneText = {
      warm: "ciepły, ludzki, z podziękowaniem",
      formal: "formalny, profesjonalny",
      short: "krótki i konkretny (1-2 zdania)",
    }[data.tone];
    const langName = data.language === "pl" ? "polski" : "angielski";

    const systemPrompt =
      "Jesteś specjalistą obsługi klienta w mediach społecznościowych dla organizacji eventowej/koncertowej. Tworzysz odpowiedzi krótkie, naturalne, bez korpomowy. Zwracasz WYŁĄCZNIE poprawny JSON.";
    const userPrompt = [
      `Platforma: ${cm.platform}`,
      postCtx ? `Kontekst posta: ${postCtx}` : null,
      `Autor komentarza: ${cm.author_name ?? "anonim"}`,
      `Treść komentarza: ${cm.content}`,
      `Wygeneruj 3 warianty odpowiedzi w języku ${langName}. Ton: ${toneText}.`,
      `Zwróć JSON: { "variants": ["wariant 1","wariant 2","wariant 3"] }`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await callAiInternal({
      userId,
      userEmail,
      scenariusz: "social_inbox_reply_suggest",
      systemPrompt,
      userPrompt,
      maxTokens: 800,
    });
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    let parsed: { variants?: string[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("AI zwróciła odpowiedź w nieprawidłowym formacie.");
    }
    const variants = Array.isArray(parsed.variants)
      ? parsed.variants.filter((v) => typeof v === "string").slice(0, 3)
      : [];
    if (variants.length === 0) throw new Error("AI nie zwróciła żadnych wariantów.");

    // Zapisz pierwszą sugestię w komentarzu
    await supabase
      .from("social_comments")
      .update({ ai_suggested_reply: variants[0], updated_at: new Date().toISOString() })
      .eq("id", data.commentId)
      .eq("organization_id", data.organizationId);

    return { variants };
  });

export const aiModerateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        commentId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ sentiment: string; flags: string[] }> => {
      const { supabase, userId, userEmail } = context;
      const { data: c } = await supabase
        .from("social_comments")
        .select("id, content")
        .eq("id", data.commentId)
        .eq("organization_id", data.organizationId)
        .maybeSingle();
      if (!c) throw new Error("Komentarz nie istnieje.");

      const systemPrompt =
        "Jesteś moderatorem treści. Klasyfikujesz komentarz pod kątem sentymentu i flag (spam, hate, urgent_question, off_topic, praise). Zwracasz WYŁĄCZNIE poprawny JSON.";
      const userPrompt = `Komentarz:\n"""${(c as { content: string }).content}"""\n\nZwróć JSON:\n{ "sentiment": "positive|neutral|negative", "flags": ["..."] }\nFlagi tylko z listy: spam, hate, urgent_question, off_topic, praise.`;

      const raw = await callAiInternal({
        userId,
        userEmail,
        scenariusz: "social_inbox_moderate",
        systemPrompt,
        userPrompt,
        maxTokens: 200,
      });
      let cleaned = raw.trim();
      const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) cleaned = fence[1].trim();
      let parsed: { sentiment?: string; flags?: string[] };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("AI zwróciła odpowiedź w nieprawidłowym formacie.");
      }
      const sentiment = ["positive", "neutral", "negative"].includes(parsed.sentiment ?? "")
        ? parsed.sentiment!
        : "neutral";
      const flagSet = new Set(["spam", "hate", "urgent_question", "off_topic", "praise"]);
      const flags = (parsed.flags ?? []).filter((f) => flagSet.has(f)).slice(0, 5);

      await supabase
        .from("social_comments")
        .update({
          ai_sentiment: sentiment,
          ai_flags: flags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.commentId)
        .eq("organization_id", data.organizationId);

      return { sentiment, flags };
    },
  );

/**
 * Seed demo komentarzy — pozwala przetestować UI skrzynki zanim ruszy OAuth.
 * Wymaga, by w organizacji było co najmniej jedno konto SM (może być nawet
 * placeholder — sprawdza tylko obecność wiersza w `social_accounts`).
 * Jeśli brak — tworzy demo-konto dla platformy 'facebook'.
 */
export const seedDemoInboxComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pobierz lub utwórz demo konto
    let { data: acct } = await supabase
      .from("social_accounts")
      .select("id, platform")
      .eq("organization_id", data.organizationId)
      .limit(1)
      .maybeSingle();

    if (!acct) {
      const ins = await supabase
        .from("social_accounts")
        .insert({
          organization_id: data.organizationId,
          platform: "facebook",
          external_account_id: "demo_page",
          account_name: "Demo Page (test)",
          scopes: [],
          status: "demo",
          connected_by: userId,
        })
        .select("id, platform")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      acct = ins.data;
    }

    const account = acct as { id: string; platform: string };

    const samples = [
      {
        author: "Anna K.",
        content: "Super koncert! Czekam na kolejną edycję, kiedy bilety?",
        sentiment: null,
      },
      {
        author: "Marek W.",
        content: "Kupcie sobie nagłośnienie bo żenada totalna",
        sentiment: null,
      },
      {
        author: "Bot Promo",
        content: "ZARABIAJ 5000 PLN DZIENNIE!!! kliknij link >>>",
        sentiment: null,
      },
      {
        author: "Karolina J.",
        content: "Czy są jeszcze miejsca na sobotę 18:00? Mam dwie wejściówki dla taty.",
        sentiment: null,
      },
    ];

    const now = Date.now();
    const rows = samples.map((s, i) => ({
      organization_id: data.organizationId,
      account_id: account.id,
      platform: account.platform,
      external_post_id: "demo_post_1",
      external_comment_id: `demo_${now}_${i}`,
      author_name: s.author,
      content: s.content,
      posted_at: new Date(now - i * 3600 * 1000).toISOString(),
      status: "new",
    }));
    const { error } = await supabase.from("social_comments").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

/**
 * Wymusza ręczną publikację posta na wszystkich docelowych platformach.
 * Używa centralnego dispatcha `publishPostToAllPlatforms` — tej samej drogi
 * używa cron `social-publish-scheduled`. Wynik per platforma jest zapisywany
 * w `social_post_results` (status + external_post_id + external_url + error).
 */
export const publishPostNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        postId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { publishPostToAllPlatforms } = await import("./social-publish.server");
    const results = await publishPostToAllPlatforms({
      postId: data.postId,
      organizationId: data.organizationId,
    });
    return { results };
  });

// ============================================================================
// CREDENTIALS APLIKACJI DEVELOPERSKIEJ (per organizacja, per platforma)
// ============================================================================
// Użytkownicy (nie-Lovable) konfigurują własną aplikację u dostawcy
// (np. developer.x.com) i wklejają Client ID + Client Secret w UI.
// Secret szyfrujemy AES-256-GCM (crypto.server.ts).

import { encryptPii, decryptPii } from "./crypto.server";
import { randomBytes, createHash } from "crypto";

export const getAppCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const candidates = credPlatformCandidates(data.platform);
    const { data: rows, error } = await supabase
      .from("social_app_credentials")
      .select("id, client_id, configured_at, configured_by, updated_at, platform")
      .eq("organization_id", data.organizationId)
      .in("platform", candidates);

    if (error) throw new Error(error.message);
    const r =
      ((rows ?? []).find((x) => x.platform === credPlatform(data.platform)) ??
        (rows ?? [])[0]) as null | {
        id: string;
        client_id: string;
        configured_at: string;
        configured_by: string;
        updated_at: string;
      };

    return {
      exists: !!r,
      clientId: r?.client_id ?? null,
      clientIdMasked: r ? maskClientIdLong(r.client_id) : null,
      configuredAt: r?.configured_at ?? null,
      updatedAt: r?.updated_at ?? null,
    };
  });

function maskClientIdLong(s: string): string {
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
}

export const saveAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema,
        clientId: z.string().trim().min(3).max(512),
        clientSecret: z.string().trim().min(3).max(2048),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const secretEnc = encryptPii(data.clientSecret);
    if (!secretEnc) throw new Error("Nie udało się zaszyfrować Client Secret.");

    const { error } = await supabase
      .from("social_app_credentials")
      .upsert(
        {
          organization_id: data.organizationId,
          platform: credPlatform(data.platform),
          client_id: data.clientId,
          client_secret_enc: secretEnc,
          configured_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,platform" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deleteAppCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("social_app_credentials")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("platform", credPlatform(data.platform));

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// OAUTH START — generuje URL do dostawcy + zapisuje state w social_oauth_states
// ============================================================================
// Na razie wspieramy tylko X (Twitter) OAuth 2.0 z PKCE. Kolejne platformy
// dodajemy w startSocialOAuth w nowych case'ach.

function getPublicOrigin(request: Request): string {
  // Za reverse proxy (nginx na VPS) request.url ma http://127.0.0.1:3001/...,
  // więc origin trzeba odtworzyć z nagłówków X-Forwarded-*.
  const h = request.headers;
  const xfHost = h.get("x-forwarded-host") ?? h.get("host");
  const xfProto = h.get("x-forwarded-proto");
  if (xfHost) {
    // Jeśli host wygląda na publiczną domenę (nie localhost / 127.x), wymuś https.
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(xfHost);
    const proto = xfProto ?? (isLocal ? "http" : "https");
    return `${proto}://${xfHost}`;
  }
  return new URL(request.url).origin;
}

function getCallbackUrl(platform: string, request: Request): string {
  // Facebook + Instagram dzielą jeden flow Meta i wspólny callback.
  // Spotify używa skróconego sluga "spotify" zamiast "spotify_artists".
  const slug =
    platform === "facebook" || platform === "instagram"
      ? "meta"
      : platform === "spotify_artists"
        ? "spotify"
        : platform;
  return `${getPublicOrigin(request)}/api/public/social/${slug}-callback`;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const startSocialOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema,
        redirectBack: z.string().max(1024).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) pobierz credentials org+platform (Meta IG dzieli z Facebook).
    //    Fallback: jeśli ktoś zapisał pod "instagram" w starszej wersji UI,
    //    spróbuj odczytać też z tej platformy.
    const lookupCandidates =
      data.platform === "instagram" || data.platform === "facebook"
        ? ["facebook", "instagram"]
        : [data.platform];
    const { data: credRows, error: credErr } = await supabase
      .from("social_app_credentials")
      .select("client_id, platform")
      .eq("organization_id", data.organizationId)
      .in("platform", lookupCandidates);
    if (credErr) throw new Error(credErr.message);
    const credRow =
      (credRows ?? []).find((r) => r.platform === "facebook") ??
      (credRows ?? [])[0];
    if (!credRow) {
      throw new Error("Brak skonfigurowanej aplikacji dla tej platformy. Najpierw wklej Client ID i Client Secret.");
    }

    const clientId = (credRow as { client_id: string }).client_id;

    // 2) wygeneruj state + PKCE
    const state = base64UrlEncode(randomBytes(32));
    const codeVerifier = base64UrlEncode(randomBytes(48));
    const codeChallenge = base64UrlEncode(
      createHash("sha256").update(codeVerifier).digest(),
    );

    // 3) callback URL (z bieżącego requestu — będzie inny w dev/prod)
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const callbackUrl = getCallbackUrl(data.platform, request);

    // 4) zapisz state w DB (TTL 15 min). codeVerifier trzymamy w redirect_back jako prefiks "pkce:".
    //    (social_oauth_states nie ma osobnej kolumny code_verifier; chowamy go w redirect_back zaszyfrowany.)
    const pkceBlob = encryptPii(JSON.stringify({ v: codeVerifier, r: data.redirectBack ?? null }));
    const { error: stateErr } = await supabase.from("social_oauth_states").insert({
      state,
      organization_id: data.organizationId,
      user_id: userId,
      platform: data.platform,
      redirect_back: pkceBlob,
    });
    if (stateErr) throw new Error(stateErr.message);

    // 5) zbuduj URL u dostawcy
    let authorizeUrl: string;
    if (data.platform === "twitter") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "tweet.read tweet.write users.read offline.access",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      authorizeUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    } else if (data.platform === "linkedin") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "openid profile email w_member_social",
        state,
      });
      authorizeUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    } else if (data.platform === "instagram") {
      // MVP Instagram używa nowego Instagram API with Instagram Login.
      // Starsze scope'y instagram_basic/content_publish są odrzucane w tej konfiguracji.
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state,
        scope: [
          "instagram_business_basic",
          "instagram_business_content_publish",
        ].join(","),
      });
      authorizeUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
    } else if (data.platform === "facebook") {
      // Facebook Pages + powiązany Instagram Business / Creator (jeden flow).
      // Scope'y IG są wymagane, żeby Graph API zwracało pole
      // `instagram_business_account` w /me/accounts oraz pozwalało publikować / czytać metryki IG.
      // UWAGA: pages_manage_engagement, instagram_manage_comments, instagram_manage_insights
      // wymagają App Review (Advanced Access) i muszą być dodane w Use Cases aplikacji Meta.
      // Bez tego Meta zwraca "Invalid Scopes" i blokuje cały dialog OAuth.
      // Trzymamy minimalny zestaw, który Standard Access pozwala wywołać od ręki —
      // wystarcza do listowania stron, publikacji postów FB+IG i pobrania IG Business Account.
      const scopes = [
        "pages_show_list",
        "pages_read_engagement",
        "pages_read_user_content",
        "pages_manage_posts",
        "pages_manage_metadata",
        "business_management",
        "instagram_basic",
        "instagram_content_publish",
      ];
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state,
        scope: scopes.join(","),
      });
      authorizeUrl = `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
    } else if (data.platform === "youtube") {
      // Google OAuth: access_type=offline + prompt=consent → zawsze dostajemy refresh_token.
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/youtube.force-ssl",
        ].join(" "),
        state,
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
      });
      authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (data.platform === "tiktok") {
      const params = new URLSearchParams({
        client_key: clientId,
        response_type: "code",
        scope: "user.info.basic,video.upload,video.publish,video.list",
        redirect_uri: callbackUrl,
        state,
      });
      authorizeUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    } else if (data.platform === "spotify_artists") {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "user-read-private user-read-email user-top-read",
        state,
        show_dialog: "true",
      });
      authorizeUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    } else {
      throw new Error(`OAuth dla platformy ${data.platform} nie jest jeszcze zaimplementowany.`);
    }

    return { authorizeUrl, callbackUrl };
  });


// ============================================================================
// IMPORT POSTÓW Z PLATFORMY (historia + bieżąca synchronizacja)
// ============================================================================
// Pobiera ostatnie N postów opublikowanych bezpośrednio na platformie
// (np. na Fanpage'u FB) i zapisuje je w social_posts (source='imported')
// + social_post_results. Crony social-sync-metrics i social-sync-inbox
// automatycznie zaczynają je obsługiwać.

export const importPostsFromAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        platform: platformSchema,
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    console.error("[social-import] importPostsFromAccountFn called", {
      organizationId: data.organizationId,
      platform: data.platform,
      limit: data.limit ?? 25,
    });

    // Sprawdź członkostwo (RLS na social_accounts już to zrobi, ale lepsza komunikacja).
    const { supabase } = context;
    const { data: acct, error: acctErr } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("platform", data.platform)
      .maybeSingle();
    if (acctErr) throw new Error(acctErr.message);
    if (!acct) throw new Error("Konto tej platformy nie jest podłączone.");

    const { importPostsFromAccount } = await import("./social-import.server");
    try {
      const result = await importPostsFromAccount({
        organizationId: data.organizationId,
        platform: data.platform,
        limit: data.limit ?? 25,
      });
      console.error("[social-import] importPostsFromAccountFn finished", {
        organizationId: data.organizationId,
        platform: data.platform,
        ...result,
      });
      return result;
    } catch (e) {
      console.error("[social-import] importPostsFromAccountFn failed", {
        organizationId: data.organizationId,
        platform: data.platform,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  });

// ============================================================================
// SYNC NA ŻĄDANIE — pojedynczy post (metryki + komentarze)
// ============================================================================

export const syncPostNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        postId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Sprawdź dostęp (RLS na social_posts już to wymusi, ale dla czytelnego błędu):
    const { data: post, error: postErr } = await supabase
      .from("social_posts")
      .select("id")
      .eq("id", data.postId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("Post nie istnieje lub brak dostępu.");

    const { data: results, error: resErr } = await supabaseAdmin
      .from("social_post_results")
      .select("post_id, platform, external_post_id, published_at")
      .eq("post_id", data.postId)
      .eq("status", "success")
      .not("external_post_id", "is", null);
    if (resErr) throw new Error(resErr.message);

    const { getAdapter, getValidAccount } = await import("./platforms/index.server");

    let metricsOk = 0;
    let commentsInserted = 0;
    const errors: string[] = [];

    for (const r of (results ?? []) as Array<{
      post_id: string;
      platform: string;
      external_post_id: string;
      published_at: string | null;
    }>) {
      const adapter = getAdapter(r.platform);
      if (!adapter) continue;
      const ctx2 = await getValidAccount({
        organizationId: data.organizationId,
        platform: r.platform,
      });
      if (!ctx2) {
        errors.push(`${r.platform}: brak podłączonego konta`);
        continue;
      }

      // Metryki
      try {
        const m = await adapter.fetchMetrics({
          account: ctx2.account,
          externalPostId: r.external_post_id,
          clientId: ctx2.credentials.clientId,
          clientSecret: ctx2.credentials.clientSecret,
        });
        await supabaseAdmin.from("social_post_metrics").insert({
          post_id: r.post_id,
          platform: r.platform,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          views: m.views,
          snapshot_at: new Date().toISOString(),
        });
        metricsOk++;
      } catch (e) {
        errors.push(`${r.platform} metryki: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Komentarze
      try {
        const { data: latest } = await supabaseAdmin
          .from("social_comments")
          .select("posted_at")
          .eq("organization_id", data.organizationId)
          .eq("platform", r.platform)
          .eq("external_post_id", r.external_post_id)
          .order("posted_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        const sinceIso =
          (latest as { posted_at: string | null } | null)?.posted_at ??
          r.published_at ??
          null;

        const items = await adapter.fetchInboxItems({
          account: ctx2.account,
          externalPostId: r.external_post_id,
          sinceIso,
          clientId: ctx2.credentials.clientId,
          clientSecret: ctx2.credentials.clientSecret,
        });
        if (items.length) {
          const rowsToInsert = items.map((it) => ({
            organization_id: data.organizationId,
            account_id: ctx2.account.id,
            platform: r.platform,
            post_id: r.post_id,
            external_post_id: it.externalPostId,
            external_comment_id: it.externalCommentId,
            external_parent_comment_id: it.externalParentCommentId ?? null,
            author_external_id: it.authorExternalId,
            author_name: it.authorName,
            author_avatar_url: it.authorAvatarUrl,
            content: it.content,
            permalink: it.permalink,
            posted_at: it.postedAt,
            like_count: it.likeCount ?? 0,
            reply_count: it.replyCount ?? 0,
            status: "new",
          }));
          const { count, error: upErr } = await supabaseAdmin
            .from("social_comments")
            .upsert(rowsToInsert, {
              onConflict: "account_id,external_comment_id",
              ignoreDuplicates: true,
              count: "exact",
            });
          if (upErr) throw new Error(upErr.message);
          commentsInserted += count ?? rowsToInsert.length;
        }
      } catch (e) {
        errors.push(`${r.platform} komentarze: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Odświeżenie URL-i mediów dla Meta (CDN URLs wygasają po ~24h).
      if (r.platform === "instagram" || r.platform === "facebook") {
        try {
          const { refreshIgPostMediaUrls, refreshFbPostMediaUrls } = await import(
            "./platforms/meta.server"
          );
          const fresh =
            r.platform === "instagram"
              ? await refreshIgPostMediaUrls({
                  externalPostId: r.external_post_id,
                  accessToken: ctx2.account.access_token,
                })
              : await refreshFbPostMediaUrls({
                  externalPostId: r.external_post_id,
                  accessToken: ctx2.account.access_token,
                });
          if (fresh && fresh.length > 0) {
            const { data: postRow } = await supabaseAdmin
              .from("social_posts")
              .select("content_per_platform")
              .eq("id", r.post_id)
              .maybeSingle();
            const cpp =
              ((postRow as { content_per_platform: Record<string, { text?: string; hashtags?: string[]; media_urls?: string[] }> } | null)
                ?.content_per_platform) ?? {};
            cpp[r.platform] = { ...(cpp[r.platform] ?? {}), media_urls: fresh };
            await supabaseAdmin
              .from("social_posts")
              .update({ content_per_platform: cpp })
              .eq("id", r.post_id);
          }
        } catch (e) {
          console.warn("[sync] media refresh failed", r.platform, e);
        }
      }
    }

    return { metricsOk, commentsInserted, errors };
  });


