// Cron: synchronizacja inboxa (nowe komentarze/odpowiedzi) dla opublikowanych postów.
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET.
// Częstotliwość zalecana: co 15 minut.
//
// Per-konto:
//   - pomijamy konta z auto_sync_inbox = false (użytkownik wyłączył sync)
//   - pomijamy konta z aktywną pauzą (sync_paused_until > now)
//   - jeśli auto_ai_moderation = true, świeżo wstawione komentarze są
//     klasyfikowane przez OpenAI (sentyment + flagi hejt/spam/...).
// Limity (max postów, okno czasowe, dzienny budżet AI) — w tabeli app_settings.
// Każdy tick loguje się do tabeli social_sync_runs (audit/monitoring).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAdapter, getValidAccount } from "@/lib/platforms/index.server";
import { MetaPermissionError } from "@/lib/platforms/meta.server";
import { getSocialSettings, recordSyncRun } from "@/lib/social-settings.server";
import { callAiInternal } from "@/lib/social.functions";

type ResultRow = {
  post_id: string;
  platform: string;
  external_post_id: string | null;
  published_at: string | null;
  post: { organization_id: string } | null;
};

type AccountFlags = {
  auto_sync_inbox: boolean;
  auto_ai_moderation: boolean;
  sync_paused_until: string | null;
};

async function moderateNewComment(args: {
  organizationId: string;
  commentId: string;
  content: string;
}): Promise<boolean> {
  const systemPrompt =
    "Jesteś moderatorem treści. Klasyfikujesz komentarz pod kątem sentymentu i flag (spam, hate, urgent_question, off_topic, praise). Zwracasz WYŁĄCZNIE poprawny JSON.";
  const userPrompt = `Komentarz:\n"""${args.content}"""\n\nZwróć JSON:\n{ "sentiment": "positive|neutral|negative", "flags": ["..."] }\nFlagi tylko z listy: spam, hate, urgent_question, off_topic, praise.`;
  try {
    const raw = await callAiInternal({
      userId: null,
      userEmail: "cron@social-sync-inbox",
      scenariusz: "social_inbox_moderate",
      systemPrompt,
      userPrompt,
      maxTokens: 200,
    });
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const parsed = JSON.parse(cleaned) as { sentiment?: string; flags?: string[] };
    const sentiment = ["positive", "neutral", "negative"].includes(parsed.sentiment ?? "")
      ? parsed.sentiment!
      : "neutral";
    const flagSet = new Set(["spam", "hate", "urgent_question", "off_topic", "praise"]);
    const flags = (parsed.flags ?? []).filter((f) => flagSet.has(f)).slice(0, 5);
    await supabaseAdmin
      .from("social_comments")
      .update({
        ai_sentiment: sentiment,
        ai_flags: flags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.commentId)
      .eq("organization_id", args.organizationId);
    return true;
  } catch (e) {
    console.warn("[social-sync-inbox] auto-AI moderation failed", args.commentId, e);
    return false;
  }
}

async function processTick() {
  const startedAt = Date.now();
  const settings = await getSocialSettings();
  const since = new Date(
    Date.now() - settings.syncInboxWindowDays * 24 * 3600 * 1000,
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("social_post_results")
    .select(
      "post_id, platform, external_post_id, published_at, post:social_posts!inner(organization_id)",
    )
    .eq("status", "success")
    .not("external_post_id", "is", null)
    .gte("published_at", since)
    .limit(settings.syncInboxMaxPosts);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ResultRow[];

  // Dzienny budżet AI moderacji — globalnie, liczone z ai_uzycie po scenariuszu.
  let aiBudgetLeft = settings.aiModerationDailyBudgetCalls;
  if (aiBudgetLeft > 0) {
    const startDay = new Date();
    startDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ai_uzycie")
      .select("id", { count: "exact", head: true })
      .eq("scenariusz", "social_inbox_moderate")
      .gte("created_at", startDay.toISOString());
    aiBudgetLeft = Math.max(0, aiBudgetLeft - (count ?? 0));
  }

  let totalInserted = 0;
  let ok = 0;
  let fail = 0;
  let skippedPermission = 0;
  let skippedDisabled = 0;
  let skippedBudget = 0;
  let aiModerated = 0;
  const errors: Array<{ ref: string; message: string }> = [];

  for (const r of rows) {
    if (!r.external_post_id || !r.post) continue;
    const adapter = getAdapter(r.platform);
    if (!adapter) continue;
    try {
      const ctx = await getValidAccount({
        organizationId: r.post.organization_id,
        platform: r.platform,
      });
      if (!ctx) continue;

      // Pobierz flagi konta (RLS w cronie omijamy supabaseAdmin)
      const { data: accFlags } = await supabaseAdmin
        .from("social_accounts")
        .select("auto_sync_inbox, auto_ai_moderation, sync_paused_until")
        .eq("id", ctx.account.id)
        .maybeSingle();
      const flags = (accFlags as AccountFlags | null) ?? {
        auto_sync_inbox: true,
        auto_ai_moderation: false,
        sync_paused_until: null,
      };
      const pausedActive =
        !!flags.sync_paused_until && new Date(flags.sync_paused_until) > new Date();
      if (!flags.auto_sync_inbox || pausedActive) {
        skippedDisabled++;
        continue;
      }

      // Najnowszy znany komentarz → bierzemy tylko nowsze.
      const { data: latest } = await supabaseAdmin
        .from("social_comments")
        .select("posted_at")
        .eq("organization_id", r.post.organization_id)
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
        account: ctx.account,
        externalPostId: r.external_post_id,
        sinceIso,
        clientId: ctx.credentials.clientId,
        clientSecret: ctx.credentials.clientSecret,
      });
      if (!items.length) {
        ok++;
        continue;
      }

      // Deduplikacja po external_comment_id
      const dedup = new Map<string, (typeof items)[number]>();
      for (const it of items) dedup.set(it.externalCommentId, it);
      const rowsToInsert = Array.from(dedup.values()).map((it) => ({
        organization_id: r.post!.organization_id,
        account_id: ctx.account.id,
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
      }));

      const { data: upserted, error: upErr } = await supabaseAdmin
        .from("social_comments")
        .upsert(rowsToInsert, {
          onConflict: "account_id,external_comment_id",
        })
        .select("id, content, ai_sentiment");
      if (upErr) throw new Error(upErr.message);
      const upsertedRows = (upserted ?? []) as Array<{
        id: string;
        content: string;
        ai_sentiment: string | null;
      }>;
      totalInserted += upsertedRows.length;
      ok++;

      // Auto-AI moderation tylko dla nowych (bez ai_sentiment) i tylko jeśli konto włączyło.
      if (flags.auto_ai_moderation && aiBudgetLeft > 0) {
        const toModerate = upsertedRows
          .filter((c) => c.ai_sentiment === null && (c.content ?? "").trim().length > 0)
          .slice(0, settings.aiModerationMaxPerTick);
        for (const c of toModerate) {
          if (aiBudgetLeft <= 0) {
            skippedBudget++;
            break;
          }
          const done = await moderateNewComment({
            organizationId: r.post.organization_id,
            commentId: c.id,
            content: c.content,
          });
          if (done) {
            aiModerated++;
            aiBudgetLeft--;
          } else {
            // failure liczone jako użycie (chroni przed pętlą drogich błędów)
            aiBudgetLeft--;
          }
        }
      } else if (flags.auto_ai_moderation && aiBudgetLeft <= 0) {
        skippedBudget++;
      }
    } catch (e) {
      if (e instanceof MetaPermissionError) {
        skippedPermission++;
        continue;
      }
      fail++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[social-sync-inbox]", r.platform, r.post_id, msg);
      if (errors.length < 10) errors.push({ ref: `${r.platform}:${r.post_id}`, message: msg });
    }
  }

  await recordSyncRun({
    job: "sync-inbox",
    startedAt,
    processed: rows.length,
    inserted: totalInserted,
    ok,
    fail,
    skippedPermission,
    skippedDisabled,
    skippedBudget,
    aiModerated,
    errors,
  });

  return {
    processed: rows.length,
    inserted: totalInserted,
    ok,
    fail,
    skippedPermission,
    skippedDisabled,
    skippedBudget,
    aiModerated,
  };
}

export const Route = createFileRoute("/api/public/social-sync-inbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const out = await processTick();
          return Response.json({ success: true, ...out });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        return Response.json({ ok: true, hint: "Use POST to run tick" });
      },
    },
  },
});
