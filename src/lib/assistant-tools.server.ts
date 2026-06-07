// Read-only narzędzia Asystenta Concertivo dla OpenAI function calling.
// Każde narzędzie ma deklarację (schema dla modelu) + handler (server-side).
// Handlery DRUGI raz waliduje uprawnienia (defense-in-depth).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hasModuleAccess,
  type EffectiveOrgPermissions,
  type OrgModuleId,
} from "@/lib/org-modules";

export type AssistantToolCtx = {
  orgId: string;
  userId: string;
  perms: EffectiveOrgPermissions;
};

export type AssistantToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

type Handler = (args: Record<string, unknown>, ctx: AssistantToolCtx) => Promise<AssistantToolResult>;

export type AssistantToolDef = {
  name: string;
  /** Moduł wymagany; null = zawsze dostępne (dla każdego członka org). */
  module: OrgModuleId | null;
  description: string;
  parameters: Record<string, unknown>;
  handler: Handler;
};

// =============================================================
// Helpery
// =============================================================

function guard(ctx: AssistantToolCtx, moduleId: OrgModuleId | null): string | null {
  if (!moduleId) return null;
  if (!hasModuleAccess(ctx.perms, moduleId)) {
    return `Brak dostępu do modułu „${moduleId}". Poproś administratora organizacji o uprawnienia.`;
  }
  return null;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asInt(v: unknown, fallback: number, min = 1, max = 50): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// =============================================================
// search_concerts
// =============================================================

const searchConcerts: AssistantToolDef = {
  name: "search_concerts",
  module: "events",
  description:
    "Zwraca listę wydarzeń/koncertów organizacji z opcjonalnym filtrem zakresu dat (YYYY-MM-DD) i statusu.",
  parameters: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "Początek zakresu (YYYY-MM-DD), opcjonalnie." },
      date_to: { type: "string", description: "Koniec zakresu (YYYY-MM-DD), opcjonalnie." },
      status: { type: "string", description: "Filtr statusu, np. 'confirmed', 'option', 'cancelled'." },
      limit: { type: "number", description: "Max liczba wyników (1–50, domyślnie 20)." },
    },
  },
  async handler(args, ctx) {
    const denied = guard(ctx, "events");
    if (denied) return { ok: false, error: denied };
    let q = supabaseAdmin
      .from("performances")
      .select("id, performance_date, name, city, status, event_kind")
      .eq("organization_id", ctx.orgId)
      .order("performance_date", { ascending: true })
      .limit(asInt(args.limit, 20));
    const df = asString(args.date_from);
    const dt = asString(args.date_to);
    const st = asString(args.status);
    if (df) q = q.gte("performance_date", df);
    if (dt) q = q.lte("performance_date", dt);
    if (st) q = q.eq("status", st);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { count: data?.length ?? 0, items: data ?? [] } };
  },
};

// =============================================================
// get_finance_summary
// =============================================================

const getFinanceSummary: AssistantToolDef = {
  name: "get_finance_summary",
  module: "budget",
  description:
    "Podsumowanie finansów organizacji: suma przychodów i wydatków (zrealizowanych) oraz planowanych wydatków, opcjonalnie w zakresie dat.",
  parameters: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "YYYY-MM-DD, opcjonalne." },
      date_to: { type: "string", description: "YYYY-MM-DD, opcjonalne." },
    },
  },
  async handler(args, ctx) {
    const denied = guard(ctx, "budget");
    if (denied) return { ok: false, error: denied };
    // Tryb 'unrealized_only' = pokazujemy tylko planowane
    const mode = ctx.perms.isOrgAdmin ? "full" : ctx.perms.budgetMode;
    const df = asString(args.date_from);
    const dt = asString(args.date_to);

    type Row = { kind: string; amount_gross: string | number; currency: string };
    const summarize = (rows: Row[]) => {
      const acc: Record<string, { income: number; expense: number }> = {};
      for (const r of rows) {
        const cur = (r.currency || "PLN").toUpperCase();
        const amt = Number(r.amount_gross || 0);
        acc[cur] ??= { income: 0, expense: 0 };
        if (r.kind === "income") acc[cur].income += amt;
        else acc[cur].expense += amt;
      }
      return acc;
    };

    const out: Record<string, unknown> = {};

    if (mode === "full") {
      let q = supabaseAdmin
        .from("organization_budget_entries")
        .select("kind, amount_gross, currency")
        .eq("organization_id", ctx.orgId)
        .eq("completed", true);
      if (df) q = q.gte("entry_date", df);
      if (dt) q = q.lte("entry_date", dt);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      out.realized_by_currency = summarize((data ?? []) as Row[]);
    } else {
      out.realized_by_currency = { note: "Brak uprawnień do danych zrealizowanych (tryb 'unrealized_only')." };
    }

    let pq = supabaseAdmin
      .from("organization_planned_expenses")
      .select("kind, amount_gross, currency")
      .eq("organization_id", ctx.orgId)
      .eq("completed", false);
    if (df) pq = pq.gte("planned_date", df);
    if (dt) pq = pq.lte("planned_date", dt);
    const { data: planned, error: pErr } = await pq;
    if (pErr) return { ok: false, error: pErr.message };
    out.planned_by_currency = summarize((planned ?? []) as Row[]);

    return { ok: true, data: out };
  },
};

// =============================================================
// search_contacts
// =============================================================

function maskTaxId(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.length > 4 ? "***" + v.slice(-4) : "***";
}

const searchContacts: AssistantToolDef = {
  name: "search_contacts",
  module: "contacts",
  description:
    "Wyszukuje kontakty organizacji po nazwie (display_name, email). Zwraca podstawowe dane bez PESEL/IBAN.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Fraza do dopasowania (case-insensitive)." },
      kind: { type: "string", description: "Filtr typu: 'person', 'company', 'artist'." },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  async handler(args, ctx) {
    const denied = guard(ctx, "contacts");
    if (denied) return { ok: false, error: denied };
    const query = asString(args.query).trim();
    if (!query) return { ok: false, error: "Pusta fraza." };
    let q = supabaseAdmin
      .from("contacts")
      .select("id, kind, display_name, email, phone, city, country_code, tax_id")
      .eq("organization_id", ctx.orgId)
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(asInt(args.limit, 20));
    const k = asString(args.kind);
    if (k) q = q.eq("kind", k);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    const items = (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      tax_id: maskTaxId(r.tax_id as string | null),
    }));
    return { ok: true, data: { count: items.length, items } };
  },
};

// =============================================================
// list_organization_members
// =============================================================

const listOrgMembers: AssistantToolDef = {
  name: "list_organization_members",
  module: null,
  description: "Zwraca listę członków organizacji wraz z rolami.",
  parameters: { type: "object", properties: {} },
  async handler(_args, ctx) {
    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, role, profiles:profiles!organization_members_user_id_fkey(display_name, email)")
      .eq("organization_id", ctx.orgId)
      .limit(100);
    if (error) {
      // fallback bez joina (gdy FK nie pasuje)
      const { data: d2, error: e2 } = await supabaseAdmin
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", ctx.orgId)
        .limit(100);
      if (e2) return { ok: false, error: e2.message };
      return { ok: true, data: { count: d2?.length ?? 0, items: d2 ?? [] } };
    }
    return { ok: true, data: { count: data?.length ?? 0, items: data ?? [] } };
  },
};

// =============================================================
// list_recent_correspondence
// =============================================================

const listRecentCorrespondence: AssistantToolDef = {
  name: "list_recent_correspondence",
  module: "mail",
  description:
    "Lista ostatnich e-maili (tylko metadane: temat, nadawca, data, folder). Nie zwraca treści.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "1–30, domyślnie 10." },
    },
  },
  async handler(args, ctx) {
    const denied = guard(ctx, "mail");
    if (denied) return { ok: false, error: denied };
    const { data: boxes, error: bErr } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id, email")
      .eq("organization_id", ctx.orgId);
    if (bErr) return { ok: false, error: bErr.message };
    const boxIds = (boxes ?? []).map((b) => b.id as string);
    if (boxIds.length === 0) return { ok: true, data: { count: 0, items: [] } };
    const { data, error } = await supabaseAdmin
      .from("email_wiadomosci")
      .select("temat, od_email, od_nazwa, folder, data_otrzymania, przeczytana")
      .in("skrzynka_id", boxIds)
      .order("data_otrzymania", { ascending: false })
      .limit(asInt(args.limit, 10, 1, 30));
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { count: data?.length ?? 0, items: data ?? [] } };
  },
};

// =============================================================
// search_knowledge_base
// =============================================================

const searchKnowledgeBase: AssistantToolDef = {
  name: "search_knowledge_base",
  module: null,
  description:
    "Wyszukuje fragmenty dokumentacji Concertivo pasujące do zapytania (semantycznie). Używaj, gdy potrzebujesz dodatkowego kontekstu.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      match_count: { type: "number", description: "1–10, domyślnie 5." },
    },
    required: ["query"],
  },
  async handler(args) {
    const { searchKb } = await import("@/lib/assistant-rag.server");
    const query = asString(args.query).trim();
    if (!query) return { ok: false, error: "Pusta fraza." };
    const hits = await searchKb(query, {
      sourceTypes: ["doc"],
      matchCount: asInt(args.match_count, 5, 1, 10),
    });
    return {
      ok: true,
      data: hits.map((h) => ({ source_path: h.source_path, content: h.content, similarity: h.similarity })),
    };
  },
};

// =============================================================
// Rejestr
// =============================================================

export const ASSISTANT_TOOLS: AssistantToolDef[] = [
  searchConcerts,
  getFinanceSummary,
  searchContacts,
  listOrgMembers,
  listRecentCorrespondence,
  searchKnowledgeBase,
];

export function buildAvailableTools(perms: EffectiveOrgPermissions): AssistantToolDef[] {
  return ASSISTANT_TOOLS.filter((t) => !t.module || hasModuleAccess(perms, t.module));
}

/** Zamiana naszych definicji na format `tools` OpenAI Chat Completions. */
export function toOpenAiTools(defs: AssistantToolDef[]) {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }));
}

export function findTool(name: string): AssistantToolDef | undefined {
  return ASSISTANT_TOOLS.find((t) => t.name === name);
}
