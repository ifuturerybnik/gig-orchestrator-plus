// Server-only RAG helpers dla Asystenta Concertivo.
// NIE importować z komponentów ani client-side.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

/** Koszt $/1M tokenów dla embeddings (text-embedding-3-small). */
export const EMBED_COST_PER_M = 0.02;

export type KbChunk = {
  id: string;
  source_type: "doc" | "code";
  source_path: string;
  content: string;
  similarity: number;
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Brak OPENAI_API_KEY.");
  return key;
}

/** Tworzy embedding pojedynczego stringa (1536 wymiarów). */
export async function embedQuery(text: string): Promise<number[]> {
  const resp = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI embed ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const payload = (await resp.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const vec = payload.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBED_DIM) {
    throw new Error("Nieprawidłowy embedding z OpenAI.");
  }
  return vec;
}

/** Embed wielu tekstów w jednym requeście (batch do 100). */
export async function embedBatch(
  texts: string[],
): Promise<{ vectors: number[][]; tokens: number }> {
  if (texts.length === 0) return { vectors: [], tokens: 0 };
  const resp = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI embed batch ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const payload = (await resp.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
    usage?: { total_tokens?: number };
  };
  const data = payload.data ?? [];
  const vectors: number[][] = new Array(texts.length);
  for (const row of data) {
    vectors[row.index] = row.embedding;
  }
  return { vectors, tokens: payload.usage?.total_tokens ?? 0 };
}

/**
 * Semantyczne wyszukiwanie w bazie wiedzy.
 * `sourceTypes` ogranicza do 'doc' i/lub 'code'.
 */
export async function searchKb(
  query: string,
  opts: { sourceTypes?: Array<"doc" | "code">; matchCount?: number } = {},
): Promise<KbChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const { data, error } = await supabaseAdmin.rpc("match_kb_chunks", {
    query_embedding: queryEmbedding as unknown as string,
    source_types: opts.sourceTypes ?? ["doc", "code"],
    match_count: opts.matchCount ?? 8,
  });
  if (error) throw new Error(`match_kb_chunks: ${error.message}`);
  return ((data ?? []) as KbChunk[]).filter((c) => c.similarity > 0.25);
}
