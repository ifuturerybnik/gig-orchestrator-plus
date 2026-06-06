import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import socialFunctionsRaw from "./social.functions.ts?raw";
import socialOauthRaw from "./social-oauth.server.ts?raw";
import socialPlatformsRaw from "./social-platforms.ts?raw";
import socialPublishRaw from "./social-publish.server.ts?raw";
import socialImportRaw from "./social-import.server.ts?raw";
import platformIndexRaw from "./platforms/index.server.ts?raw";
import platformTypesRaw from "./platforms/types.ts?raw";
import metaServerRaw from "./platforms/meta.server.ts?raw";
import metaCallbackRaw from "../routes/api/public/social.meta-callback.ts?raw";
import syncInboxRaw from "../routes/api/public/social-sync-inbox.ts?raw";
import syncMetricsRaw from "../routes/api/public/social-sync-metrics.ts?raw";
import publishScheduledRaw from "../routes/api/public/social-publish-scheduled.ts?raw";
import platformsTabRaw from "../components/social/PlatformsTab.tsx?raw";
import aiStudioTabRaw from "../components/social/AiStudioTab.tsx?raw";
import inboxTabRaw from "../components/social/InboxTab.tsx?raw";
import scheduleTabRaw from "../components/social/ScheduleTab.tsx?raw";
import statsTabRaw from "../components/social/StatsTab.tsx?raw";
import postDetailsRaw from "../components/social/PostDetailsDialog.tsx?raw";
import appCredentialsRaw from "../components/social/AppCredentialsForm.tsx?raw";
import metaInstructionsRaw from "../components/social/MetaSetupInstructions.tsx?raw";

const CODE_FILES = [
  ["src/lib/social.functions.ts", socialFunctionsRaw],
  ["src/lib/social-oauth.server.ts", socialOauthRaw],
  ["src/lib/social-platforms.ts", socialPlatformsRaw],
  ["src/lib/social-publish.server.ts", socialPublishRaw],
  ["src/lib/social-import.server.ts", socialImportRaw],
  ["src/lib/platforms/index.server.ts", platformIndexRaw],
  ["src/lib/platforms/types.ts", platformTypesRaw],
  ["src/lib/platforms/meta.server.ts", metaServerRaw],
  ["src/routes/api/public/social.meta-callback.ts", metaCallbackRaw],
  ["src/routes/api/public/social-sync-inbox.ts", syncInboxRaw],
  ["src/routes/api/public/social-sync-metrics.ts", syncMetricsRaw],
  ["src/routes/api/public/social-publish-scheduled.ts", publishScheduledRaw],
  ["src/components/social/PlatformsTab.tsx", platformsTabRaw],
  ["src/components/social/AiStudioTab.tsx", aiStudioTabRaw],
  ["src/components/social/InboxTab.tsx", inboxTabRaw],
  ["src/components/social/ScheduleTab.tsx", scheduleTabRaw],
  ["src/components/social/StatsTab.tsx", statsTabRaw],
  ["src/components/social/PostDetailsDialog.tsx", postDetailsRaw],
  ["src/components/social/AppCredentialsForm.tsx", appCredentialsRaw],
  ["src/components/social/MetaSetupInstructions.tsx", metaInstructionsRaw],
] as const;

const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-5": { in: 1.25, out: 10 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function maskClientId(s: string | null | undefined): string | null {
  if (!s) return null;
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
}

async function getSnapshot(supabase: SupabaseClient, organizationId: string) {
  const [accounts, credentials, results, comments, logs] = await Promise.all([
    supabase
      .from("social_accounts")
      .select("platform, external_account_id, account_name, scopes, token_expires_at, status, last_error, connected_at, updated_at")
      .eq("organization_id", organizationId)
      .in("platform", ["facebook", "instagram"]),
    supabase
      .from("social_app_credentials")
      .select("platform, client_id, extra, configured_at, updated_at")
      .eq("organization_id", organizationId)
      .in("platform", ["facebook", "instagram"]),
    supabase
      .from("social_post_results")
      .select("post_id, platform, status, external_post_id, external_url, error_message, published_at")
      .in("platform", ["facebook", "instagram"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("social_comments")
      .select("platform, external_post_id, external_comment_id, external_parent_comment_id, author_name, content, status, like_count, reply_count, posted_at")
      .eq("organization_id", organizationId)
      .in("platform", ["facebook", "instagram"])
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("social_moderation_log")
      .select("action, result, error_message, performed_at, comment_id")
      .eq("organization_id", organizationId)
      .order("performed_at", { ascending: false })
      .limit(20),
  ]);

  if (accounts.error) throw new Error(accounts.error.message);
  if (credentials.error) throw new Error(credentials.error.message);
  if (results.error) throw new Error(results.error.message);
  if (comments.error) throw new Error(comments.error.message);
  if (logs.error) throw new Error(logs.error.message);

  return {
    generatedAt: new Date().toISOString(),
    organizationId,
    knownErrorsFromScreenshots: [
      'IG like 400: GraphMethodException / code 100 / subcode 33 / "Authorization Error".',
      "IG reply: brak instagram_manage_comments; konto Instagram zapisane ze scope'ami Facebook Login: pages_show_list, business_management, instagram_basic, instagram_content_publish, pages_read_engagement, pages_manage_metadata, pages_manage_posts, public_profile.",
    ],
    accounts: accounts.data ?? [],
    credentials: (credentials.data ?? []).map((r: { client_id?: string | null }) => ({
      ...r,
      client_id: undefined,
      client_id_masked: maskClientId(r.client_id),
    })),
    recentResults: results.data ?? [],
    recentComments: comments.data ?? [],
    recentModerationLogs: logs.data ?? [],
  };
}

function buildBundle(snapshot: Awaited<ReturnType<typeof getSnapshot>>): string {
  const code = CODE_FILES
    .map(([path, content]) => `\n\n--- FILE: ${path} ---\n\n\`\`\`tsx\n${content}\n\`\`\``)
    .join("");
  return `# Concertivo — Facebook/Instagram/Social integration diagnostic bundle

Generated: ${snapshot.generatedAt}

## Security note
This export intentionally excludes encrypted access tokens, refresh tokens, client secrets, service-role keys and private runtime secrets. Client IDs are masked.

## Known Meta account/configuration snapshot

\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

## Current working hypothesis

Instagram is currently connected as an Instagram account discovered from Facebook Page OAuth, not as a separate Instagram Login token: the account scopes contain \`instagram_basic\` / \`instagram_content_publish\`, but do not contain \`instagram_business_basic\`, \`instagram_business_content_publish\`, \`instagram_business_manage_comments\`. In \`meta.server.ts\`, this makes \`isInstagramLoginAccount(account)\` false, so comment management/likes are attempted through Facebook Graph / legacy permissions. The screenshots show exactly this failure path: like returns Meta code 100/subcode 33 Authorization Error; reply is rejected due to missing comment-management permission.

## Code files
${code}
`;
}

export const getSocialDiagnosticsBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const snapshot = await getSnapshot(context.supabase, data.organizationId);
    return { filename: `concertivo-social-meta-diagnostics-${data.organizationId}.md`, content: buildBundle(snapshot) };
  });

export const askSocialDiagnosticsAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      organizationId: z.string().uuid(),
      messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000) }))
        .min(1)
        .max(12),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Brak OPENAI_API_KEY w konfiguracji serwera.");
    const snapshot = await getSnapshot(context.supabase, data.organizationId);
    const bundle = buildBundle(snapshot).slice(0, 180_000);

    const { data: konf } = await supabaseAdmin.from("ai_konfiguracja").select("*").eq("id", 1).maybeSingle();
    const cfg = (konf ?? {}) as { enabled?: boolean; default_model?: string; scenariusz_model?: Record<string, string>; temperature?: number; max_tokens?: number | null; monthly_limit_usd?: number };
    if (cfg.enabled === false) throw new Error("Integracja AI jest wyłączona.");
    const model = cfg.scenariusz_model?.social_code_diagnostics_chat || cfg.default_model || "gpt-4o-mini";

    const startedAt = Date.now();
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: cfg.temperature ?? 0.2,
        max_completion_tokens: cfg.max_tokens ?? 2500,
        messages: [
          {
            role: "system",
            content:
              "Jesteś senior developerem diagnozującym integracje social media w Concertivo. Analizuj kod, snapshot kont Meta i błędy. Nie zgaduj: wskazuj pliki/funkcje, przyczynę, minimalny patch i ryzyka. Odpowiadaj po polsku.",
          },
          { role: "user", content: `Kontekst kodu i diagnostyki:\n\n${bundle}` },
          ...data.messages,
        ],
      }),
    });
    const text = await resp.text();
    let payload: { error?: { message?: string }; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string } }> } | null = null;
    try { payload = JSON.parse(text); } catch { /* noop */ }
    const duration = Date.now() - startedAt;
    if (!resp.ok) {
      const err = payload?.error?.message || text.slice(0, 500) || `OpenAI ${resp.status}`;
      await supabaseAdmin.from("ai_uzycie").insert({ user_id: context.userId, user_email: context.userEmail, scenariusz: "social_code_diagnostics_chat", model, status: "error", error: err.slice(0, 500), duration_ms: duration });
      throw new Error(err);
    }
    const tIn = Number(payload?.usage?.prompt_tokens ?? 0);
    const tOut = Number(payload?.usage?.completion_tokens ?? 0);
    const p = PRICING[model];
    const cost = p ? (tIn / 1_000_000) * p.in + (tOut / 1_000_000) * p.out : 0;
    await supabaseAdmin.from("ai_uzycie").insert({ user_id: context.userId, user_email: context.userEmail, scenariusz: "social_code_diagnostics_chat", model, tokens_in: tIn, tokens_out: tOut, cost_usd: cost, duration_ms: duration, status: "ok" });
    return { content: payload?.choices?.[0]?.message?.content ?? "", model, tokens_in: tIn, tokens_out: tOut, cost_usd: cost };
  });