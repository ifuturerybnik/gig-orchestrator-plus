// Worker przetwarzający zlecenia gus_scan_jobs.
// Wywoływany przez /api/public/gus-scan-tick. Każdy tick przetwarza
// do MAX_PER_TICK rekordów, respektując globalny throttle GUS (1 req/s).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Job = {
  id: string;
  identifier: "nip" | "regon" | "krs";
  fields: string[];
  entity_ids: string[];
  status: string;
  total: number;
  processed: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  changes: ChangeEntry[];
  log: LogEntry[];
};

type LogEntry = { ts: number; level: "info" | "ok" | "warn" | "err"; text: string };
type ChangeEntry = {
  entity_id: string;
  name: string | null;
  result: "updated" | "skipped" | "error";
  fields?: Record<string, { from: string | null; to: string | null }>;
  reason?: string;
};

const MAX_PER_TICK = 20; // ~20s przy throttle 1/s
const FULL_FIELDS = new Set(["powiat", "gmina"]);

// Mapowanie pól z odpowiedzi GUS na kolumny public_entities + ekstrakcja wartości.
function gusValue(dane: Record<string, unknown> | null, field: string): string | null {
  if (!dane) return null;
  const addr = (dane.adres ?? {}) as Record<string, unknown>;
  switch (field) {
    case "nip": return (dane.nip as string) || null;
    case "regon": return (dane.regon as string) || null;
    case "krs": return (dane.krs as string) || null;
    case "name": return (dane.nazwa as string) || null;
    case "wojewodztwo": return ((addr.wojewodztwo as string) || "").toLowerCase() || null;
    case "powiat": return ((addr.powiat as string) || "").toLowerCase() || null;
    case "gmina": return ((addr.gmina as string) || "").toLowerCase() || null;
    case "miejscowosc": return (addr.miejscowosc as string) || null;
    case "kod_pocztowy": return (addr.kod_pocztowy as string) || null;
    case "poczta": return null; // GUS nie zwraca "poczty"
    case "ulica": {
      const { street } = parseUlica((addr.ulica as string) || "", (addr.nr_domu as string) || "");
      return street || null;
    }
    case "nr_domu": {
      const { number } = parseUlica((addr.ulica as string) || "", (addr.nr_domu as string) || "");
      return number || null;
    }
    default:
      return null;
  }
}

function pushLog(job: Job, level: LogEntry["level"], text: string) {
  job.log.push({ ts: Date.now(), level, text });
  if (job.log.length > 2000) job.log = job.log.slice(-1500);
}

async function persist(job: Job, currentEntityId: string | null) {
  await supabaseAdmin
    .from("gus_scan_jobs")
    .update({
      status: job.status,
      processed: job.processed,
      updated_count: job.updated_count,
      skipped_count: job.skipped_count,
      error_count: job.error_count,
      current_entity_id: currentEntityId,
      changes: job.changes,
      log: job.log,
    })
    .eq("id", job.id);
}

async function processOne(job: Job, entityId: string, gusLookupFn: GusLookupFn): Promise<void> {
  // Wczytaj rekord.
  const { data: row, error } = await supabaseAdmin
    .from("public_entities")
    .select("id, name, nip, regon, krs, wojewodztwo, powiat, gmina, miejscowosc, kod_pocztowy, poczta, ulica, nr_domu")
    .eq("id", entityId)
    .maybeSingle();
  if (error || !row) {
    job.error_count++;
    job.changes.push({ entity_id: entityId, name: null, result: "error", reason: error?.message || "rekord nie istnieje" });
    pushLog(job, "err", `Rekord ${entityId}: ${error?.message || "nie istnieje"}`);
    return;
  }
  const entity = row as Record<string, string | null> & { id: string; name: string | null };
  const identifierValue = entity[job.identifier];
  if (!identifierValue) {
    job.skipped_count++;
    job.changes.push({ entity_id: entityId, name: entity.name, result: "skipped", reason: `brak ${job.identifier.toUpperCase()}` });
    pushLog(job, "warn", `· ${entity.name ?? "?"} — pomijam (brak ${job.identifier.toUpperCase()})`);
    return;
  }

  // Czy potrzebujemy pełnego raportu (powiat/gmina)?
  const wantsFull = job.fields.some((f) => FULL_FIELDS.has(f));
  const scope: "basic" | "full" = wantsFull ? "full" : "basic";

  let result;
  try {
    result = await gusLookupFn({
      [job.identifier]: identifierValue,
      scope,
    } as Parameters<GusLookupFn>[0]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    job.error_count++;
    job.changes.push({ entity_id: entityId, name: entity.name, result: "error", reason: msg });
    pushLog(job, "err", `✗ ${entity.name ?? "?"}: ${msg}`);
    return;
  }

  const dane = (result?.dane ?? null) as Record<string, unknown> | null;
  if (!dane) {
    job.skipped_count++;
    job.changes.push({ entity_id: entityId, name: entity.name, result: "skipped", reason: "GUS: brak danych" });
    pushLog(job, "warn", `· ${entity.name ?? "?"} — brak w GUS`);
    return;
  }

  // Zbuduj patch — tylko dla zaznaczonych pól; ustaw wartość, jeżeli pusto lub się różni.
  const patch: Record<string, string> = {};
  const changedFields: Record<string, { from: string | null; to: string | null }> = {};
  for (const f of job.fields) {
    const newVal = gusValue(dane, f);
    if (!newVal) continue;
    const current = entity[f] ?? null;
    const a = (current ?? "").trim().toLowerCase();
    const b = newVal.trim().toLowerCase();
    if (a === b) continue;
    patch[f] = newVal;
    changedFields[f] = { from: current, to: newVal };
  }

  if (Object.keys(patch).length === 0) {
    job.skipped_count++;
    job.changes.push({ entity_id: entityId, name: entity.name, result: "skipped", reason: "zgodne z GUS" });
    pushLog(job, "info", `· ${entity.name ?? "?"} — zgodne z GUS, bez zmian`);
    return;
  }

  const { error: upErr } = await supabaseAdmin
    .from("public_entities")
    .update({ ...patch, source: "scanner:gus" })
    .eq("id", entityId);
  if (upErr) {
    job.error_count++;
    job.changes.push({ entity_id: entityId, name: entity.name, result: "error", reason: upErr.message });
    pushLog(job, "err", `✗ ${entity.name ?? "?"}: ${upErr.message}`);
    return;
  }
  job.updated_count++;
  job.changes.push({ entity_id: entityId, name: entity.name, result: "updated", fields: changedFields });
  pushLog(job, "ok", `✓ ${entity.name ?? "?"} — zaktualizowano: ${Object.keys(patch).join(", ")}`);
}

type GusLookupFn = (input: { nip?: string; regon?: string; krs?: string; scope?: "basic" | "full" }) => Promise<{ dane?: unknown } | null | undefined>;

export async function processGusScanTick(): Promise<{ jobsTouched: number; processed: number }> {
  // Atomowo zabieraj kolejny job (running lub queued).
  const { data: jobs } = await supabaseAdmin
    .from("gus_scan_jobs")
    .select("*")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (!jobs || jobs.length === 0) return { jobsTouched: 0, processed: 0 };

  const job = jobs[0] as Job;

  if (job.status === "queued") {
    await supabaseAdmin
      .from("gus_scan_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);
    job.status = "running";
    pushLog(job, "info", "Start przetwarzania.");
  }

  // Lazy import — gusLookup żyje w `*.functions.ts`, ale tylko handler() jest server-only.
  // Ten plik jest .server.ts, więc bezpiecznie wywołujemy bezpośrednio bity wymagane.
  const { gusLookupCore } = await import("./gus-core.server");

  let processedThisTick = 0;
  const idsToProcess = job.entity_ids.slice(job.processed, job.processed + MAX_PER_TICK);

  for (const entityId of idsToProcess) {
    // Sprawdź czy nie anulowano w trakcie.
    const { data: latest } = await supabaseAdmin
      .from("gus_scan_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (!latest || latest.status === "cancelled") {
      pushLog(job, "warn", "Anulowano przez użytkownika.");
      job.status = "cancelled";
      await persist(job, null);
      return { jobsTouched: 1, processed: processedThisTick };
    }

    await processOne(job, entityId, gusLookupCore);
    job.processed++;
    processedThisTick++;
    // Persist po każdym rekordzie, by UI widział live progress.
    await persist(job, entityId);
  }

  // Koniec?
  if (job.processed >= job.total) {
    job.status = "done";
    pushLog(job, "ok", `Zakończono. Zaktualizowano: ${job.updated_count}, pominięto: ${job.skipped_count}, błędy: ${job.error_count}.`);
    await supabaseAdmin
      .from("gus_scan_jobs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        processed: job.processed,
        updated_count: job.updated_count,
        skipped_count: job.skipped_count,
        error_count: job.error_count,
        changes: job.changes,
        log: job.log,
        current_entity_id: null,
      })
      .eq("id", job.id);
  }

  return { jobsTouched: 1, processed: processedThisTick };
}
