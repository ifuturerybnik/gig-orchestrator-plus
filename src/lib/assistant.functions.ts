// Server functions Asystenta Concertivo — client-safe wrappers.
// Sterowanie wątkami, wiadomościami, statusem bazy wiedzy i reindeksacją.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = z.string().uuid();

// =========================================================================
// Pomocnicze
// =========================================================================

async function isSuperAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return ((data ?? []) as Array<{ role: string }>).some(
    (r) => r.role === "super_admin" || r.role === "admin_staff",
  );
}

async function assertMemberOfOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  if (await isSuperAdmin(supabase, userId)) return;
  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Brak dostępu do tej organizacji.");
}

// =========================================================================
// Wątki
// =========================================================================

export type AssistantThread = {
  id: string;
  org_id: string;
  title: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export const listAssistantThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orgId: UUID }).parse(input))
  .handler(async ({ data, context }): Promise<AssistantThread[]> => {
    const { supabase, userId } = context;
    await assertMemberOfOrg(supabase, userId, data.orgId);
    const { data: rows, error } = await supabase
      .from("ai_assistant_threads")
      .select("id, org_id, title, archived, created_at, updated_at")
      .eq("org_id", data.orgId)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AssistantThread[];
  });

export const createAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: UUID, title: z.string().trim().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    await assertMemberOfOrg(supabase, userId, data.orgId);
    const { data: row, error } = await supabase
      .from("ai_assistant_threads")
      .insert({
        user_id: userId,
        org_id: data.orgId,
        title: data.title ?? "Nowa rozmowa",
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Nie udało się utworzyć wątku.");
    return { id: row.id as string };
  });

export const renameAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ threadId: UUID, title: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("ai_assistant_threads")
      .update({ title: data.title })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: UUID }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("ai_assistant_threads")
      .update({ archived: true })
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =========================================================================
// Wiadomości
// =========================================================================

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  created_at: string;
  cost_usd: number;
};

export const listAssistantMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ threadId: UUID }).parse(input))
  .handler(async ({ data, context }): Promise<AssistantMessage[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ai_assistant_messages")
      .select("id, role, content, created_at, cost_usd")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AssistantMessage[];
  });

// =========================================================================
// Wysłanie wiadomości (MVP non-streaming)
// =========================================================================

const SYSTEM_PROMPT_BASE = `Jesteś Asystentem Concertivo — pomagasz użytkownikom obsługiwać aplikację Concertivo (system zarządzania koncertami).

ZASADY:
- Odpowiadaj zwięźle po polsku.
- Bazuj na fragmentach dokumentacji i kodu z sekcji KONTEKST. Jeśli czegoś nie wiesz, powiedz to wprost.
- NIGDY nie cytuj kodu źródłowego ani nie pokazuj fragmentów kodu użytkownikowi. Kod służy WYŁĄCZNIE Twojemu zrozumieniu.
- Nie ujawniaj danych osobowych (PESEL, IBAN, pełnych adresów e-mail spoza organizacji).
- Nie wymyślaj funkcjonalności, których nie ma w dokumentacji.
- Jeśli pytanie dotyczy modułu, do którego użytkownik nie ma dostępu, poinformuj o tym i nie udzielaj szczegółów.

PRYWATNOŚĆ DANYCH (odpowiadaj zgodnie z tym przy pytaniach „kto ma dostęp do moich/naszych danych", „kto widzi nasze dane", itp.):
- Dostęp do danych organizacji mają WYŁĄCZNIE użytkownicy tej organizacji, zgodnie z nadanymi im uprawnieniami do poszczególnych modułów.
- Właściciele/operator aplikacji Concertivo (i-Future) NIE mają wglądu do danych organizacji ani do danych wrażliwych (m.in. PESEL, IBAN, treść korespondencji, kontakty, budżety). Dane wrażliwe są dodatkowo szyfrowane.
- Superadmini Concertivo zarządzają wyłącznie infrastrukturą i konfiguracją techniczną — nie przeglądają zawartości danych organizacji.`;

const SUPERADMIN_SUFFIX = `\n\nUWAGA: Rozmawiasz z superadminem Concertivo — wolno Ci cytować fragmenty kodu, jeśli pomoże to w odpowiedzi.`;

function stripCodeBlocks(text: string): string {
  // Usuwa bloki ```...``` poza ```text``` / zwykłym tekstem
  return text.replace(/```(?:ts|tsx|js|jsx|sql|bash|sh|json|py|html|css)?\n[\s\S]*?```/g, "[fragment kodu ukryty]");
}

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: UUID,
        content: z.string().trim().min(1).max(8000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, userEmail } = context;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Brak OPENAI_API_KEY na serwerze.");

    // 1) Wątek + org
    const { data: thread, error: thErr } = await supabase
      .from("ai_assistant_threads")
      .select("id, org_id")
      .eq("id", data.threadId)
      .maybeSingle();
    if (thErr || !thread) throw new Error("Wątek nie istnieje lub brak dostępu.");
    const orgId = thread.org_id as string;

    // 2) Sprawdź czy asystent włączony + limit org
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("assistant_enabled, assistant_monthly_limit_usd")
      .eq("id", orgId)
      .maybeSingle();
    if (!org || org.assistant_enabled === false) {
      throw new Error("Asystent jest wyłączony dla tej organizacji.");
    }
    const monthlyLimit = Number(org.assistant_monthly_limit_usd ?? 5);

    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);
    const { data: used } = await supabaseAdmin
      .from("ai_uzycie")
      .select("cost_usd")
      .eq("org_id", orgId)
      .gte("created_at", startMonth.toISOString());
    const monthlyUsed = (used ?? []).reduce(
      (s, r) => s + Number((r as { cost_usd: number }).cost_usd || 0),
      0,
    );
    if (monthlyUsed >= monthlyLimit) {
      throw new Error(
        `Przekroczono miesięczny limit Asystenta (${monthlyLimit} USD). Skontaktuj się z administratorem organizacji.`,
      );
    }

    // 3) Zapis wiadomości użytkownika
    await supabase.from("ai_assistant_messages").insert({
      thread_id: data.threadId,
      role: "user",
      content: data.content,
    });

    // 4) Pobierz historię (ostatnie 20)
    const { data: history } = await supabase
      .from("ai_assistant_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(20);
    const past = ((history ?? []) as Array<{ role: string; content: string }>)
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant");

    // 5) RAG — wyszukaj kontekst (doc + code), oddzielnie żeby zachować równowagę
    const { searchKb } = await import("@/lib/assistant-rag.server");
    const [docHits, codeHits] = await Promise.all([
      searchKb(data.content, { sourceTypes: ["doc"], matchCount: 5 }).catch(() => []),
      searchKb(data.content, { sourceTypes: ["code"], matchCount: 5 }).catch(() => []),
    ]);

    const docCtx = docHits
      .map((h, i) => `[DOC ${i + 1} · ${h.source_path}]\n${h.content}`)
      .join("\n\n");
    const codeCtx = codeHits
      .map((h, i) => `[CODE ${i + 1} · ${h.source_path}]\n${h.content}`)
      .join("\n\n");

    const isSuper = await isSuperAdmin(supabase, userId);
    const systemPrompt =
      SYSTEM_PROMPT_BASE +
      (isSuper ? SUPERADMIN_SUFFIX : "") +
      (docCtx ? `\n\nKONTEKST — DOKUMENTACJA:\n${docCtx}` : "") +
      (codeCtx ? `\n\nKONTEKST — KOD (do Twojego zrozumienia, NIE cytuj):\n${codeCtx}` : "");

    // 6) Wywołanie OpenAI Chat Completions
    const model = "gpt-5-mini";
    const startedAt = Date.now();
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...past.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_completion_tokens: 1200,
      }),
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
      const errMsg = payload?.error?.message || `OpenAI ${resp.status}`;
      await supabaseAdmin.from("ai_uzycie").insert({
        user_id: userId,
        user_email: userEmail,
        scenariusz: "assistant",
        model,
        status: "error",
        error: errMsg.slice(0, 500),
        duration_ms: duration,
        org_id: orgId,
        thread_id: data.threadId,
      });
      throw new Error(errMsg);
    }

    const tIn = Number(payload?.usage?.prompt_tokens ?? 0);
    const tOut = Number(payload?.usage?.completion_tokens ?? 0);
    // gpt-5-mini: 0.25 / 2.00 per 1M
    const cost = (tIn / 1_000_000) * 0.25 + (tOut / 1_000_000) * 2.0;
    let content = payload?.choices?.[0]?.message?.content ?? "";

    // 7) Post-filter — nie cytuj kodu dla nie-superadminów
    if (!isSuper) content = stripCodeBlocks(content);

    // 8) Zapis odpowiedzi + log kosztów
    await supabase.from("ai_assistant_messages").insert({
      thread_id: data.threadId,
      role: "assistant",
      content,
      tokens_in: tIn,
      tokens_out: tOut,
      cost_usd: cost,
    });

    await supabaseAdmin.from("ai_uzycie").insert({
      user_id: userId,
      user_email: userEmail,
      scenariusz: "assistant",
      model,
      tokens_in: tIn,
      tokens_out: tOut,
      cost_usd: cost,
      duration_ms: duration,
      status: "ok",
      org_id: orgId,
      thread_id: data.threadId,
    });

    return {
      content,
      cost_usd: cost,
      monthly_used: monthlyUsed + cost,
      monthly_limit: monthlyLimit,
    };
  });

// =========================================================================
// Status bazy wiedzy + reindeks (superadmin)
// =========================================================================

export type KbStatus = {
  totalChunks: number;
  docChunks: number;
  codeChunks: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastDocsIndexed: number;
  lastCodeFilesIndexed: number;
  daysSinceLastRun: number | null;
};

export const getAssistantKbStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KbStatus> => {
    const { supabase, userId } = context;
    if (!(await isSuperAdmin(supabase, userId))) {
      throw new Error("Tylko superadmin.");
    }
    const { data: counts } = await supabaseAdmin
      .from("ai_kb_chunks")
      .select("source_type", { count: "exact", head: false });
    const rows = (counts ?? []) as Array<{ source_type: string }>;
    const totalChunks = rows.length;
    const docChunks = rows.filter((r) => r.source_type === "doc").length;
    const codeChunks = rows.filter((r) => r.source_type === "code").length;

    const { data: lastRun } = await supabaseAdmin
      .from("ai_kb_index_runs")
      .select("started_at, status, docs_indexed, code_files_indexed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastRunAt = (lastRun?.started_at as string | undefined) ?? null;
    const daysSinceLastRun = lastRunAt
      ? Math.floor((Date.now() - new Date(lastRunAt).getTime()) / 86_400_000)
      : null;

    return {
      totalChunks,
      docChunks,
      codeChunks,
      lastRunAt,
      lastRunStatus: (lastRun?.status as string | undefined) ?? null,
      lastDocsIndexed: Number(lastRun?.docs_indexed ?? 0),
      lastCodeFilesIndexed: Number(lastRun?.code_files_indexed ?? 0),
      daysSinceLastRun,
    };
  });

export const reindexAssistantKb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await isSuperAdmin(supabase, userId))) {
      throw new Error("Tylko superadmin może reindeksować.");
    }
    const { reindexAll } = await import("@/lib/assistant-indexer.server");
    const result = await reindexAll();
    return result;
  });
