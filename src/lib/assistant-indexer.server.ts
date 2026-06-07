// Server-only indekser bazy wiedzy Asystenta.
// Czyta pliki docs/assistant/*.md (RAG dokumentacji) oraz wybrane pliki kodu
// z src/lib + src/components + src/routes (RAG kodu), tnie na chunki i
// zapisuje do public.ai_kb_chunks.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embedBatch, EMBED_COST_PER_M } from "@/lib/assistant-rag.server";

const PROJECT_ROOT = process.cwd();
const DOCS_DIR = join(PROJECT_ROOT, "docs", "assistant");
const CODE_DIRS = [
  join(PROJECT_ROOT, "src", "lib"),
  join(PROJECT_ROOT, "src", "components"),
  join(PROJECT_ROOT, "src", "routes"),
];
const CODE_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

const CHUNK_SIZE = 800; // znaków
const CHUNK_OVERLAP = 100;
const BATCH_SIZE = 64; // ile chunków na jedno wywołanie embeddings

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length <= size) return [t];
  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + size, t.length);
    out.push(t.slice(start, end));
    if (end >= t.length) break;
    start = end - overlap;
  }
  return out;
}

async function walk(dir: string, predicate: (path: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  let entries: Array<{ name: string; isDir: boolean }>;
  try {
    const raw = await readdir(dir, { withFileTypes: true });
    entries = raw.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDir) {
      out.push(...(await walk(full, predicate)));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

type PendingChunk = {
  source_type: "doc" | "code";
  source_path: string;
  chunk_index: number;
  content: string;
};

async function embedAndInsert(pending: PendingChunk[]): Promise<{ chunks: number; tokens: number }> {
  let chunksWritten = 0;
  let tokensUsed = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const slice = pending.slice(i, i + BATCH_SIZE);
    const { vectors, tokens } = await embedBatch(slice.map((c) => c.content));
    tokensUsed += tokens;
    const rows = slice.map((c, idx) => ({
      source_type: c.source_type,
      source_path: c.source_path,
      chunk_index: c.chunk_index,
      content: c.content,
      // pgvector akceptuje literal stringowy '[...]'
      embedding: `[${vectors[idx].join(",")}]`,
      tokens: Math.ceil(c.content.length / 4),
    }));
    const { error } = await supabaseAdmin.from("ai_kb_chunks").insert(rows);
    if (error) throw new Error(`insert ai_kb_chunks: ${error.message}`);
    chunksWritten += rows.length;
  }
  return { chunks: chunksWritten, tokens: tokensUsed };
}

async function collectDocChunks(): Promise<{ chunks: PendingChunk[]; files: number }> {
  const files = await walk(DOCS_DIR, (p) => p.endsWith(".md"));
  const out: PendingChunk[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const rel = relative(PROJECT_ROOT, file);
    chunkText(text).forEach((content, idx) => {
      if (content.trim().length < 20) return;
      out.push({ source_type: "doc", source_path: rel, chunk_index: idx, content });
    });
  }
  return { chunks: out, files: files.length };
}

async function collectCodeChunks(): Promise<{ chunks: PendingChunk[]; files: number }> {
  const out: PendingChunk[] = [];
  let fileCount = 0;
  for (const dir of CODE_DIRS) {
    const files = await walk(dir, (p) => CODE_EXT.test(p));
    fileCount += files.length;
    for (const file of files) {
      try {
        const s = await stat(file);
        if (s.size > 200_000) continue; // pomiń bardzo duże pliki
      } catch {
        continue;
      }
      const text = await readFile(file, "utf8");
      const rel = relative(PROJECT_ROOT, file);
      // dla kodu prefiks ułatwia LLM zrozumienie pochodzenia
      chunkText(text, 1200, 150).forEach((content, idx) => {
        if (content.trim().length < 40) return;
        out.push({
          source_type: "code",
          source_path: rel,
          chunk_index: idx,
          content: `// ${rel}\n${content}`,
        });
      });
    }
  }
  return { chunks: out, files: fileCount };
}

/** Pełny reindeks: TRUNCATE + ponowne wczytanie wszystkiego. */
export async function reindexAll(): Promise<{
  runId: string;
  docs: number;
  codeFiles: number;
  chunks: number;
  costUsd: number;
}> {
  // 1) Otwórz run
  const { data: run, error: runErr } = await supabaseAdmin
    .from("ai_kb_index_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`ai_kb_index_runs insert: ${runErr?.message}`);
  const runId = run.id as string;

  try {
    // 2) Wyczyść istniejące chunki (proste i przewidywalne dla MVP)
    const { error: delErr } = await supabaseAdmin
      .from("ai_kb_chunks")
      .delete()
      .gte("created_at", "1900-01-01");
    if (delErr) throw new Error(`delete ai_kb_chunks: ${delErr.message}`);

    // 3) Zbierz chunki
    const docs = await collectDocChunks();
    const code = await collectCodeChunks();
    const all = [...docs.chunks, ...code.chunks];

    // 4) Embed + insert
    const { chunks, tokens } = await embedAndInsert(all);
    const costUsd = (tokens / 1_000_000) * EMBED_COST_PER_M;

    await supabaseAdmin
      .from("ai_kb_index_runs")
      .update({
        finished_at: new Date().toISOString(),
        docs_indexed: docs.files,
        code_files_indexed: code.files,
        chunks_total: chunks,
        cost_usd: costUsd,
        status: "ok",
      })
      .eq("id", runId);

    return { runId, docs: docs.files, codeFiles: code.files, chunks, costUsd };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("ai_kb_index_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        error: msg.slice(0, 500),
      })
      .eq("id", runId);
    throw err;
  }
}
