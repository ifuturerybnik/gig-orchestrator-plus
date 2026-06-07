// Server functions Asystenta Concertivo — client-safe wrappers.
// Sterowanie wątkami, wiadomościami, statusem bazy wiedzy i reindeksacją.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantToolResult } from "@/lib/assistant-tools.server";

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

const AttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  dataBase64: z.string().min(1).max(8_000_000), // ~6 MB po dekodzie; twardy limit per plik 5 MB sprawdzamy dalej
});

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        threadId: UUID,
        content: z.string().trim().min(1).max(8000),
        attachments: z.array(AttachmentSchema).max(3).optional(),
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

    // 3) Przetwórz załączniki (obrazy + PDF) PRZED zapisem
    const { processAttachments } = await import("@/lib/assistant-attachments.server");
    const processed = await processAttachments(data.attachments ?? []);

    // 4) Pobierz historię PRZED zapisem bieżącej wiadomości
    const { data: history } = await supabase
      .from("ai_assistant_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: false })
      .limit(20);
    const past = ((history ?? []) as Array<{ role: string; content: string }>)
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant");

    // 5) Zapis wiadomości użytkownika (z notatką o załącznikach)
    const contentForStorage = processed.summary
      ? `${data.content}\n\n📎 Załączniki: ${processed.summary}`
      : data.content;
    await supabase.from("ai_assistant_messages").insert({
      thread_id: data.threadId,
      role: "user",
      content: contentForStorage,
    });

    // 6) RAG — kontekst (na bazie samego tekstu pytania)
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

    // 6b) Uprawnienia i dostępne narzędzia
    const { loadEffectivePerms } = await import("@/lib/organizations.functions");
    const perms = await loadEffectivePerms(supabase, userId, orgId);
    const { buildAvailableTools, toOpenAiTools, findTool } = await import(
      "@/lib/assistant-tools.server"
    );
    const availableTools = buildAvailableTools(perms);
    const toolsForOpenAi = toOpenAiTools(availableTools);
    const allowedToolNames = new Set(availableTools.map((t) => t.name));

    const toolsHint = availableTools.length
      ? `\n\nDOSTĘPNE NARZĘDZIA (wywołaj, gdy potrzebujesz aktualnych danych organizacji):\n` +
        availableTools.map((t) => `- ${t.name}: ${t.description}`).join("\n")
      : "\n\nNie masz dostępu do żadnych narzędzi odczytu danych organizacji w tej sesji.";

    const systemPrompt =
      SYSTEM_PROMPT_BASE +
      (isSuper ? SUPERADMIN_SUFFIX : "") +
      toolsHint +
      (docCtx ? `\n\nKONTEKST — DOKUMENTACJA:\n${docCtx}` : "") +
      (codeCtx ? `\n\nKONTEKST — KOD (do Twojego zrozumienia, NIE cytuj):\n${codeCtx}` : "");

    // 7) Pętla z tool-callami (max 4 iteracje)
    const model = "gpt-5-mini";
    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
    type OaiMsg = {
      role: "system" | "user" | "assistant" | "tool";
      content: string | ContentPart[] | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
      name?: string;
    };

    // Budujemy treść bieżącej wiadomości user — multimodalna, gdy są obrazy/PDF
    const userTextWithPdf = processed.pdfText
      ? `${data.content}\n\n${processed.pdfText}`
      : data.content;
    const currentUser: OaiMsg = processed.imageParts.length
      ? {
          role: "user",
          content: [
            { type: "text", text: userTextWithPdf },
            ...processed.imageParts,
          ],
        }
      : { role: "user", content: userTextWithPdf };

    const messages: OaiMsg[] = [
      { role: "system", content: systemPrompt },
      ...past.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      currentUser,
    ];

    let totalIn = 0;
    let totalOut = 0;
    let totalDuration = 0;
    let finalContent = "";
    const toolLog: Array<{ name: string; ok: boolean; ms: number }> = [];

    for (let iter = 0; iter < 4; iter++) {
      const startedAt = Date.now();
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          ...(toolsForOpenAi.length ? { tools: toolsForOpenAi, tool_choice: "auto" } : {}),
          max_completion_tokens: 1200,
        }),
      });
      totalDuration += Date.now() - startedAt;
      const text = await resp.text();
      let payload: {
        error?: { message?: string };
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
      } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        /* noop */
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
          duration_ms: totalDuration,
          org_id: orgId,
          thread_id: data.threadId,
        });
        throw new Error(errMsg);
      }
      totalIn += Number(payload?.usage?.prompt_tokens ?? 0);
      totalOut += Number(payload?.usage?.completion_tokens ?? 0);

      const choice = payload?.choices?.[0];
      const msg = choice?.message;
      const toolCalls = msg?.tool_calls ?? [];

      if (toolCalls.length === 0) {
        finalContent = msg?.content ?? "";
        break;
      }

      // Dopisz wiadomość asystenta z tool_calls
      messages.push({
        role: "assistant",
        content: msg?.content ?? "",
        tool_calls: toolCalls,
      });

      // Wykonaj każde wywołanie narzędzia
      for (const tc of toolCalls) {
        const def = findTool(tc.function.name);
        const ms0 = Date.now();
        let result: AssistantToolResult;
        if (!def) {
          result = { ok: false, error: `Nieznane narzędzie: ${tc.function.name}` };
        } else if (!allowedToolNames.has(def.name)) {
          result = { ok: false, error: `Brak uprawnień do narzędzia: ${def.name}` };
        } else {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            parsed = {};
          }
          try {
            result = await def.handler(parsed, { orgId, userId, perms });
          } catch (e) {
            result = { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        }
        const ms = Date.now() - ms0;
        toolLog.push({ name: tc.function.name, ok: result.ok, ms });

        // Zapis do historii (rola 'tool') — pomocne w debug i ciągłości wątku
        await supabase.from("ai_assistant_messages").insert({
          thread_id: data.threadId,
          role: "tool",
          content: JSON.stringify(result).slice(0, 8000),
          tool_call_id: tc.id,
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }

    // gpt-5-mini: 0.25 / 2.00 per 1M
    const cost = (totalIn / 1_000_000) * 0.25 + (totalOut / 1_000_000) * 2.0;
    if (!isSuper) finalContent = stripCodeBlocks(finalContent);

    // 7) Zapis odpowiedzi + log kosztów
    await supabase.from("ai_assistant_messages").insert({
      thread_id: data.threadId,
      role: "assistant",
      content: finalContent,
      tokens_in: totalIn,
      tokens_out: totalOut,
      cost_usd: cost,
    });

    await supabaseAdmin.from("ai_uzycie").insert({
      user_id: userId,
      user_email: userEmail,
      scenariusz: "assistant",
      model,
      tokens_in: totalIn,
      tokens_out: totalOut,
      cost_usd: cost,
      duration_ms: totalDuration,
      status: "ok",
      org_id: orgId,
      thread_id: data.threadId,
    });

    return {
      content: finalContent,
      cost_usd: cost,
      monthly_used: monthlyUsed + cost,
      monthly_limit: monthlyLimit,
      tools_used: toolLog,
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
