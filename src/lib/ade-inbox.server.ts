// Server-only helpers for ADE (e-Doręczenia) inbox: token cache, list, fetch.
// Uses the mTLS client from ade-client.server.ts.

import { adeRawRequest, fetchAdeToken, loadAdeConfig } from "@/lib/ade-client.server";

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAdeAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 30_000 > now) return tokenCache.token;
  const res = await fetchAdeToken();
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`OAuth2 błąd HTTP ${res.status}: ${res.body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.body) as { access_token: string; expires_in?: number };
  if (!parsed.access_token) throw new Error("Brak access_token w odpowiedzi OAuth2");
  const ttl = (parsed.expires_in ?? 300) * 1000;
  tokenCache = { token: parsed.access_token, expiresAt: now + ttl };
  return parsed.access_token;
}

export async function requireEdoreczeniaAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error) throw new Error(`Nie udało się sprawdzić uprawnień: ${(error as Error).message ?? "błąd"}`);
  const roles = ((data as { role: string }[] | null) ?? []).map((r) => r.role);
  if (!roles.includes("super_admin") && !roles.includes("admin_staff")) throw new Error("Brak uprawnień administratora");
}

export async function adeApiCall(opts: {
  method: string;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
  binary?: boolean;
  accept?: string;
}): Promise<{ status: number; body: string; bodyBuffer?: Buffer; json: unknown; headers: Record<string, string> }> {
  const token = await getAdeAccessToken();
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: opts.accept ?? "application/json",
  };
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await adeRawRequest({
    method: opts.method,
    path: opts.path + qs,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    timeoutMs: opts.timeoutMs ?? 20000,
    binary: opts.binary,
  });
  let json: unknown = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    /* niepoprawny JSON — zostaw null */
  }
  return { status: res.status, body: res.body, bodyBuffer: res.bodyBuffer, json, headers: res.headers };
}

export type AdeInboxItem = {
  id: string;
  from?: string;
  to?: string;
  subject?: string;
  receivedAt?: string;
  creationDate?: string;
  sentAt?: string;
  status?: string;
};


export type AdeFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH";

/** Zwraca listę wiadomości ze skrzynki (limit ustawia klient). */
export async function listAdeInboxRaw(params: { limit?: number; page?: number; folder?: AdeFolder } = {}) {
  const cfg = loadAdeConfig();
  // UA API v3: GET /api/v3/{eDeliveryAddress}/messages
  const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/messages`;
  const res = await adeApiCall({
    method: "GET",
    path,
    query: {
      limit: params.limit ?? 50,
      page: params.page ?? 0,
      // Filtr folderu (jeśli API go zignoruje, dostaniemy Odebrane).
      folder: params.folder ?? "INBOX",
    },
  });
  return res;
}

export async function getAdeMessageRaw(messageId: string) {
  const cfg = loadAdeConfig();
  const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/messages/${encodeURIComponent(messageId)}`;
  return await adeApiCall({ method: "GET", path });
}


/** Zwraca surową listę elementów (zachowuje pełny obiekt) niezależnie od kształtu odpowiedzi. */
export function extractRawItems(raw: unknown): Record<string, unknown>[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { messages?: unknown[] })?.messages)
      ? ((raw as { messages: unknown[] }).messages)
      : Array.isArray((raw as { items?: unknown[] })?.items)
        ? ((raw as { items: unknown[] }).items)
        : Array.isArray((raw as { content?: unknown[] })?.content)
          ? ((raw as { content: unknown[] }).content)
          : [];
  return arr.map((it) => (it ?? {}) as Record<string, unknown>);
}

/** Wyciąga adres e-Delivery i nazwę firmy z węzła "from"/"to" (obiekt lub tablica). */
function extractParty(node: unknown): { address?: string; name?: string } {
  if (!node) return {};
  const one = Array.isArray(node) ? (node[0] ?? {}) : node;
  if (typeof one === "string") return { address: one };
  const o = one as Record<string, unknown>;
  const address =
    (o.eDeliveryAddress as string | undefined) ??
    (o.address as string | undefined) ??
    (o.edeliveryAddress as string | undefined);
  const contributor = (o.contributor ?? {}) as Record<string, unknown>;
  const name =
    (contributor.companyName as string | undefined) ??
    (contributor.name as string | undefined) ??
    ([contributor.firstName, contributor.lastName].filter(Boolean).join(" ") || undefined);
  return { address, name };
}

/** Best-effort mapowanie odpowiedzi UA API na strukturę używaną w UI. */
export function normalizeInboxItems(raw: unknown): (AdeInboxItem & { fromName?: string; toName?: string })[] {
  return extractRawItems(raw).map((o) => {
    const meta = (o.messageMetadata ?? o.metadata ?? {}) as Record<string, unknown>;
    const idRaw =
      (meta.messageId as string | undefined) ??
      (o.messageId as string | undefined) ??
      (o.id as string | undefined) ??
      (o.uuid as string | undefined) ??
      "";
    const fromParty = extractParty(meta.from ?? o.from);
    const toParty = extractParty(meta.to ?? o.to);
    const subject =
      (meta.subject as string | undefined) ??
      (o.subject as string | undefined) ??
      (meta.title as string | undefined);
    const receivedAt =
      (meta.receiptDate as string | undefined) ??
      (meta.timestamp as string | undefined) ??
      (meta.submissionDate as string | undefined) ??
      (o.receivedAt as string | undefined) ??
      (o.createdAt as string | undefined);
    const creationDate =
      (meta.creationDate as string | undefined) ??
      (meta.createDate as string | undefined) ??
      (o.creationDate as string | undefined);
    const sentAt =
      (meta.submissionDate as string | undefined) ??
      (meta.sendDate as string | undefined) ??
      (o.sentAt as string | undefined);
    const status =
      (meta.shippingService as string | undefined) ??
      (o.status as string | undefined) ??
      (o.state as string | undefined);
    return {
      id: String(idRaw),
      from: fromParty.address,
      fromName: fromParty.name,
      to: toParty.address,
      toName: toParty.name,
      subject,
      receivedAt,
      creationDate,
      sentAt,
      status,
    };
  });
}


// ─────────────────────────────── Persystencja ────────────────────────────────

const BUCKET = "edoreczenia";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Idempotentne utworzenie bucketu (private). */
export async function ensureEdoreczeniaBucket(): Promise<void> {
  const admin = await getAdmin();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await admin.storage.createBucket(BUCKET, { public: false });
}

export type SyncSummary = {
  ok: boolean;
  mailbox: string;
  fetched: number;
  inserted: number;
  updated: number;
  error?: string;
};

/** Pobierz listę wiadomości z ADE (per folder) i upsertuj do public.edoreczenia_deliveries. */
export async function syncInboxToDb(params: { limit?: number; folder?: AdeFolder } = {}): Promise<SyncSummary> {
  const cfg = loadAdeConfig();
  const folder: AdeFolder = params.folder ?? "INBOX";
  const summary: SyncSummary = { ok: false, mailbox: cfg.mailboxAddress, fetched: 0, inserted: 0, updated: 0 };
  try {
    const res = await listAdeInboxRaw({ limit: params.limit ?? 100, folder });
    if (res.status < 200 || res.status >= 300) {
      summary.error = `HTTP ${res.status}`;
      return summary;
    }
    const rawItems = extractRawItems(res.json);
    const normalized = normalizeInboxItems(res.json);
    summary.fetched = rawItems.length;

    const admin = await getAdmin();
    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const n = normalized[i];
      if (!n.id) continue;
      const { data: existing } = await admin
        .from("edoreczenia_deliveries")
        .select("id")
        .eq("ade_message_id", n.id)
        .maybeSingle();
      const bodyText = typeof (raw as { textBody?: unknown }).textBody === "string"
        ? ((raw as { textBody: string }).textBody)
        : typeof (raw as { bodyText?: unknown }).bodyText === "string"
          ? ((raw as { bodyText: string }).bodyText)
          : null;
      const row = {
        direction: folder === "SENT" ? ("outbound" as const) : ("inbound" as const),
        ade_message_id: n.id,
        mailbox_address: cfg.mailboxAddress,
        folder,
        from_address: n.from ?? null,
        to_address: n.to ?? cfg.mailboxAddress,
        subject: n.subject ?? null,
        received_at: n.receivedAt ?? null,
        creation_date: (n as { creationDate?: string }).creationDate ?? null,
        sent_at: (n as { sentAt?: string }).sentAt ?? null,
        status: n.status ?? "new",
        raw,
        body_text: bodyText,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await admin.from("edoreczenia_deliveries").update(row).eq("id", existing.id);
        summary.updated++;
      } else {
        await admin.from("edoreczenia_deliveries").insert(row);
        summary.inserted++;
      }
    }

    await admin.from("edoreczenia_sync_state").upsert(
      {
        mailbox_address: cfg.mailboxAddress,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mailbox_address" },
    );
    summary.ok = true;
    return summary;
  } catch (err) {
    summary.error = (err as Error).message;
    try {
      const admin = await getAdmin();
      await admin.from("edoreczenia_sync_state").upsert(
        {
          mailbox_address: cfg.mailboxAddress,
          last_error: summary.error,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mailbox_address" },
      );
    } catch {
      /* ignore */
    }
    return summary;
  }
}

/** Wyciągnij listę załączników z payloadu wiadomości (best-effort). */
function extractAttachmentRefs(
  payload: unknown,
): Array<{ id: string; filename: string; mime?: string; size?: number }> {
  const o = (payload ?? {}) as Record<string, unknown>;
  const list =
    (o.attachments as unknown[]) ??
    ((o.messageContent as Record<string, unknown> | undefined)?.attachments as unknown[]) ??
    ((o.content as Record<string, unknown> | undefined)?.attachments as unknown[]) ??
    [];
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => {
      const a = (it ?? {}) as Record<string, unknown>;
      const id = String(a.attachmentId ?? a.id ?? a.uuid ?? "");
      const filename = String(a.filename ?? a.name ?? a.fileName ?? id ?? "attachment");
      const mime = (a.mimeType ?? a.contentType ?? a.mime) as string | undefined;
      const size = (a.size ?? a.sizeBytes ?? a.fileSize) as number | undefined;
      return { id, filename, mime, size };
    })
    .filter((a) => a.id);
}

/** Pobierz treść wiadomości z ADE, zapisz body_text i załączniki do Storage/DB. */
export async function fetchAndStoreMessage(deliveryId: string): Promise<{
  ok: boolean;
  bodyText?: string;
  attachments: Array<{
    id: string;
    filename: string;
    mime_type?: string;
    size_bytes?: number;
    storage_path: string;
  }>;
  error?: string;
}> {
  const admin = await getAdmin();
  const { data: delivery, error: dErr } = await admin
    .from("edoreczenia_deliveries")
    .select("id, ade_message_id, mailbox_address")
    .eq("id", deliveryId)
    .maybeSingle();
  if (dErr || !delivery) return { ok: false, attachments: [], error: "Nie znaleziono wiadomości w bazie" };
  if (!delivery.ade_message_id) return { ok: false, attachments: [], error: "Brak ade_message_id" };

  try {
    await ensureEdoreczeniaBucket();
    const cfg = loadAdeConfig();
    const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/messages/${encodeURIComponent(delivery.ade_message_id)}`;
    const res = await adeApiCall({ method: "GET", path });
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, attachments: [], error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
    }
    // Detal UA API v3 również potrafi zwrócić tablicę — rozpakuj do pojedynczego obiektu.
    const payloadRaw = res.json;
    const payload = (Array.isArray(payloadRaw) ? (payloadRaw[0] ?? {}) : (payloadRaw ?? {})) as Record<string, unknown>;
    const meta = ((payload.messageMetadata ?? {}) as Record<string, unknown>);
    const bodyText =
      typeof (payload as { textBody?: unknown }).textBody === "string"
        ? ((payload as { textBody: string }).textBody)
        : typeof (payload as { bodyText?: unknown }).bodyText === "string"
          ? ((payload as { bodyText: string }).bodyText)
          : res.body;
    const fromParty = extractParty(meta.from);
    const toParty = extractParty(meta.to);
    const subject = (meta.subject as string | undefined) ?? (payload.subject as string | undefined);
    const receivedAt =
      (meta.receiptDate as string | undefined) ??
      (meta.timestamp as string | undefined);
    const creationDate =
      (meta.creationDate as string | undefined) ??
      (meta.createDate as string | undefined);
    const sentAt =
      (meta.submissionDate as string | undefined) ??
      (meta.sendDate as string | undefined);

    const refs = extractAttachmentRefs(payload);
    const stored: Array<{
      id: string;
      filename: string;
      mime_type?: string;
      size_bytes?: number;
      storage_path: string;
    }> = [];

    for (const ref of refs) {
      try {
        const attPath = `${path}/attachments/${encodeURIComponent(ref.id)}`;
        const attRes = await adeApiCall({ method: "GET", path: attPath, binary: true, timeoutMs: 60000 });
        if (attRes.status < 200 || attRes.status >= 300 || !attRes.bodyBuffer) continue;
        const storagePath = `${delivery.id}/${ref.id}-${ref.filename}`;
        const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, attRes.bodyBuffer, {
          contentType: ref.mime ?? attRes.headers["content-type"] ?? "application/octet-stream",
          upsert: true,
        });
        if (upErr) continue;

        const { data: existingAtt } = await admin
          .from("edoreczenia_attachments")
          .select("id")
          .eq("delivery_id", delivery.id)
          .eq("ade_attachment_id", ref.id)
          .maybeSingle();
        const row = {
          delivery_id: delivery.id,
          ade_attachment_id: ref.id,
          filename: ref.filename,
          mime_type: ref.mime ?? null,
          size_bytes: ref.size ?? attRes.bodyBuffer.length,
          storage_path: storagePath,
        };
        if (existingAtt?.id) await admin.from("edoreczenia_attachments").update(row).eq("id", existingAtt.id);
        else await admin.from("edoreczenia_attachments").insert(row);

        stored.push({
          id: ref.id,
          filename: ref.filename,
          mime_type: row.mime_type ?? undefined,
          size_bytes: row.size_bytes,
          storage_path: storagePath,
        });
      } catch {
        /* pomiń pojedynczy załącznik */
      }
    }

    const update: Record<string, unknown> = {
      body_text: bodyText,
      raw: payload,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (subject) update.subject = subject;
    if (fromParty.address) update.from_address = fromParty.address;
    if (toParty.address) update.to_address = toParty.address;
    if (receivedAt) update.received_at = receivedAt;
    if (creationDate) update.creation_date = creationDate;
    if (sentAt) update.sent_at = sentAt;


    await admin.from("edoreczenia_deliveries").update(update).eq("id", delivery.id);

    return { ok: true, bodyText, attachments: stored };
  } catch (err) {
    return { ok: false, attachments: [], error: (err as Error).message };
  }
}

/** Wygeneruj signed URL dla załącznika (godzina). Opcjonalnie wymuś pobranie. */
export async function signedAttachmentUrl(
  storagePath: string,
  download?: string,
): Promise<string | null> {
  const admin = await getAdmin();
  const opts = download ? { download } : undefined;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60, opts);
  return data?.signedUrl ?? null;
}

function isZipBuffer(buf?: Buffer | null): boolean {
  if (!buf || buf.length < 4) return false;
  const sig = buf.subarray(0, 4).toString("binary");
  return sig === "PK\u0003\u0004" || sig === "PK\u0005\u0006" || sig === "PK\u0007\u0008";
}

function normalizeEvidenceList(input: unknown): Array<Record<string, unknown>> {
  const root = Array.isArray(input) ? (input[0] ?? input) : input;
  const obj = (root ?? {}) as Record<string, unknown>;
  if (Array.isArray(obj.evidences)) return obj.evidences as Array<Record<string, unknown>>;
  if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
  if (Array.isArray(obj.content)) return obj.content as Array<Record<string, unknown>>;
  if (Array.isArray(input)) return input as Array<Record<string, unknown>>;
  return [];
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function evidenceFileBase(evidence: Record<string, unknown>, fallbackId: string): string {
  const type = firstString(evidence.type, evidence.evidenceType, evidence.code) ?? "dowod";
  return `${type}_${fallbackId}`.replace(/[^\p{L}\p{N}._-]+/gu, "_");
}

/** Pobierz ZIP z dowodami technicznymi (evidence) i zapisz do Storage.
 *  UA API v3 nie zwraca gotowego ZIP-a — zwraca listę dowodów jako JSON,
 *  a pliki pobiera się per evidenceId. Budujemy ZIP po stronie serwera.
 */
export async function fetchAndStoreEvidenceZip(deliveryId: string): Promise<
  { ok: true; storagePath: string; sizeBytes: number } | { ok: false; error: string }
> {
  const admin = await getAdmin();
  const { data: delivery } = await admin
    .from("edoreczenia_deliveries")
    .select("id, ade_message_id, raw")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "Nie znaleziono wiadomości w bazie" };
  if (!delivery.ade_message_id) return { ok: false, error: "Brak ade_message_id" };

  try {
    await ensureEdoreczeniaBucket();
    const cfg = loadAdeConfig();
    const mailboxBase = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}`;
    const messageId = encodeURIComponent(delivery.ade_message_id);
    const base = `${mailboxBase}/messages/${messageId}`;

    // 1) Preferuj oficjalną paczkę ZIP z technicznymi dowodami wiadomości.
    // Dokumentacja UA API: GET /{eDeliveryAddress}/evidences/{messageId}/technical-evidences-file
    const candidates = [
      `${mailboxBase}/evidences/${messageId}/technical-evidences-file`,
      `${mailboxBase}/evidences/${messageId}/technical-eevidences-file`,
      `${base}/message-archive-file`,
      `${base}/evidences/package`,
      `${base}/evidences/archive`,
      `${base}/evidences/zip`,
      `${base}/evidence-package`,
    ];
    let zipBuf: Buffer | null = null;
    let lastErr = "";
    for (const p of candidates) {
      const r = await adeApiCall({
        method: "GET",
        path: p,
        binary: true,
        timeoutMs: 60000,
        accept: "application/zip, application/octet-stream, */*",
      });
      const ct = (r.headers["content-type"] ?? "").toLowerCase();
      if (
        r.status >= 200 &&
        r.status < 300 &&
        r.bodyBuffer &&
        (ct.includes("zip") || isZipBuffer(r.bodyBuffer))
      ) {
        zipBuf = r.bodyBuffer;
        break;
      }
      lastErr = `HTTP ${r.status} @ ${p}: ${r.body.slice(0, 120)}`;
    }

    // 2) Fallback: pobierz listę evidences (JSON) i każdy plik osobno, zbuduj ZIP.
    if (!zipBuf) {
      const listRes = await adeApiCall({ method: "GET", path: `${base}/evidences` });
      if (listRes.status < 200 || listRes.status >= 300) {
        return { ok: false, error: `HTTP ${listRes.status} przy /evidences: ${listRes.body.slice(0, 160)}` };
      }
      const evList = normalizeEvidenceList(listRes.json);

      if (!evList.length) return { ok: false, error: lastErr || "Brak dowodów do pobrania" };

      const JSZipMod = (await import("jszip")).default;
      const zip = new JSZipMod();
      let added = 0;
      const perEvidenceErrors: string[] = [];
      for (const e of evList) {
        const evId = firstString(e.evidenceId, e.id, e.uuid);
        if (!evId) continue;
        const encodedEvId = encodeURIComponent(evId);
        const messageTypes = [
          firstString(e.messageType, e.message_type, e.serviceType, e.shippingService),
          "Evidence",
          "evidence",
          "PURDE",
          "PUH",
        ].filter((v, idx, arr): v is string => !!v && arr.indexOf(v) === idx);
        // UA API v3: binarny dowód jest pod /evidences/{messageType}/{evidenceId}.
        const evCandidates = messageTypes.flatMap((messageType) => [
          `${mailboxBase}/evidences/${encodeURIComponent(messageType)}/${encodedEvId}`,
        ]);
        let payload: { buf: Buffer; ct: string } | null = null;
        for (const p of evCandidates) {
          const r = await adeApiCall({
            method: "GET",
            path: p,
            binary: true,
            timeoutMs: 60000,
            accept: "application/xml, application/pdf, application/octet-stream, */*",
          });
          if (r.status >= 200 && r.status < 300 && r.bodyBuffer && r.bodyBuffer.length > 0) {
            const ct = (r.headers["content-type"] ?? "").toLowerCase();
            const head = r.bodyBuffer.slice(0, 512).toString("utf8").trim();
            // Endpoint metadanych zwraca JSON — nie zapisuj go jako dowodu; dowód ma być XML/PDF/binarny.
            if (ct.includes("application/json") || /^[\[{]/.test(head)) {
              perEvidenceErrors.push(`${evId}: JSON zamiast pliku @ ${p} — ${head.slice(0, 160)}`);
              continue;
            }
            payload = { buf: r.bodyBuffer, ct };
            break;
          }
          perEvidenceErrors.push(`${evId}: HTTP ${r.status} @ ${p} — ${r.body.slice(0, 160)}`);
        }
        if (!payload) continue;
        const startsXml = payload.buf.slice(0, 5).toString("utf8").trim().startsWith("<");
        const ext = payload.ct.includes("pdf")
          ? "pdf"
          : payload.ct.includes("xml") || startsXml
            ? "xml"
            : payload.ct.includes("json")
              ? "json"
              : "bin";
        zip.file(`${evidenceFileBase(e, evId)}.${ext}`, payload.buf);
        added++;
      }
      // metadane pomocnicze
      zip.file("index.json", JSON.stringify(evList, null, 2));
      if (!added) {
        // Nie udało się pobrać żadnego dowodu — zwróć błąd zamiast pustego ZIP-a,
        // żeby użytkownik od razu wiedział co się stało.
        return {
          ok: false,
          error:
            "Nie udało się pobrać plików dowodów z UA API. Szczegóły: " +
            perEvidenceErrors.slice(0, 5).join(" | "),
        };
      }
      const out = await zip.generateAsync({ type: "nodebuffer" });
      zipBuf = out as Buffer;
    }

    const storagePath = `${delivery.id}/evidences-${delivery.ade_message_id}.zip`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, zipBuf, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upErr) return { ok: false, error: upErr.message };

    await admin.from("edoreczenia_deliveries").update({ evidence_storage_path: storagePath }).eq("id", delivery.id);
    return { ok: true, storagePath, sizeBytes: zipBuf.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─────────────────────────────── Wysyłka ────────────────────────────────

export type SendAdeMessageInput = {
  recipients: string[];        // adresy AE:PL-...
  subject: string;
  bodyText: string;
  caseNumber?: string;
  attachments?: Array<{ filename: string; mimeType?: string; contentBase64: string }>;
};

export type SendAdeMessageResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  attempts?: Array<{ path: string; status: number; snippet: string }>;
};

/** Wyślij wiadomość przez UA API v3.
 *  Próbujemy kilku wariantów payloadu/ścieżki, aby być zgodnym z produkcyjnym UA API PP.
 */
export async function sendAdeMessage(input: SendAdeMessageInput): Promise<SendAdeMessageResult> {
  const cfg = loadAdeConfig();
  const mailbox = cfg.mailboxAddress;
  const recipients = (input.recipients ?? []).map((r) => r.trim()).filter(Boolean);
  if (!recipients.length) return { ok: false, error: "Brak adresatów" };
  if (!input.subject?.trim()) return { ok: false, error: "Temat jest wymagany" };

  const attachments = (input.attachments ?? []).map((a) => ({
    filename: a.filename,
    mimeType: a.mimeType ?? "application/octet-stream",
    content: a.contentBase64,
  }));

  const commonMeta = {
    from: [{ eDeliveryAddress: mailbox }],
    to: recipients.map((address) => ({ eDeliveryAddress: address })),
    subject: input.subject.trim(),
    caseIdentifier: input.caseNumber?.trim() || undefined,
  };

  // Warianty payloadu wg różnych rewizji UA API v3.
  const payloads: Array<{ label: string; body: Record<string, unknown> }> = [
    {
      label: "v3-nested",
      body: {
        messageMetadata: commonMeta,
        textBody: input.bodyText ?? "",
        attachments,
      },
    },
    {
      label: "v3-flat",
      body: {
        from: mailbox,
        to: recipients,
        subject: input.subject.trim(),
        textBody: input.bodyText ?? "",
        caseIdentifier: input.caseNumber?.trim() || undefined,
        attachments,
      },
    },
  ];

  const paths = [
    `/api/v3/${encodeURIComponent(mailbox)}/messages`,
    `/api/v3/${encodeURIComponent(mailbox)}/messages/send`,
  ];

  const attempts: Array<{ path: string; status: number; snippet: string }> = [];
  for (const path of paths) {
    for (const p of payloads) {
      const res = await adeApiCall({
        method: "POST",
        path,
        body: p.body,
        timeoutMs: 60000,
      });
      attempts.push({ path: `${path} [${p.label}]`, status: res.status, snippet: res.body.slice(0, 200) });
      if (res.status >= 200 && res.status < 300) {
        const j = (Array.isArray(res.json) ? res.json[0] : res.json) as Record<string, unknown> | null;
        const meta = ((j?.messageMetadata ?? {}) as Record<string, unknown>) || {};
        const messageId =
          (meta.messageId as string | undefined) ??
          (j?.messageId as string | undefined) ??
          (j?.id as string | undefined);
        return { ok: true, messageId, attempts };
      }
      // 400/415 – zmiana kształtu payloadu może pomóc; 404 – zmieniamy ścieżkę.
      if (res.status !== 400 && res.status !== 415 && res.status !== 422) break;
    }
  }
  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    error: last ? `HTTP ${last.status} @ ${last.path}: ${last.snippet}` : "Brak odpowiedzi z ADE",
    attempts,
  };
}

// ────────────────────── Archiwum wiadomości (jak biznes.gov) ──────────────────────

/** Zwraca SHA3-512 (hex). Jeśli środowisko nie obsługuje SHA3, fallback do SHA-512. */
async function hashFile(buf: Buffer | Uint8Array): Promise<{ hash: string; algo: "SHA3-512" | "SHA-512" }> {
  const nodeCrypto = await import("crypto");
  try {
    const h = nodeCrypto.createHash("sha3-512").update(buf).digest("hex");
    return { hash: h, algo: "SHA3-512" };
  } catch {
    const h = nodeCrypto.createHash("sha512").update(buf).digest("hex");
    return { hash: h, algo: "SHA-512" };
  }
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Zbuduj (i zapisz w Storage) ZIP z pełnym archiwum wiadomości — analogicznie do pobierania z biznes.gov.
 *  Struktura:
 *   - MetrykaArchiwum.xml
 *   - TrescWiadomosci.txt
 *   - załączniki (oryginalne nazwy plików)
 *   - dowody techniczne + potwierdzenia biznesowe (BPWP/BPOP) – pliki z evidence
 */
export async function fetchAndBuildMessageArchive(
  deliveryId: string,
): Promise<{ ok: true; storagePath: string; filename: string } | { ok: false; error: string }> {
  const admin = await getAdmin();
  const { data: delivery } = await admin
    .from("edoreczenia_deliveries")
    .select("id, ade_message_id, body_text, raw")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "Nie znaleziono wiadomości" };
  if (!delivery.ade_message_id) return { ok: false, error: "Brak ade_message_id" };

  try {
    await ensureEdoreczeniaBucket();
    const cfg = loadAdeConfig();
    const mailboxBase = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}`;
    const messageId = encodeURIComponent(delivery.ade_message_id);
    const base = `${mailboxBase}/messages/${messageId}`;

    // 1) Preferuj oficjalny ZIP archiwum wiadomości (jeżeli UA API go udostępnia).
    const archiveCandidates = [
      `${base}/message-archive-file`,
      `${base}/archive-file`,
      `${base}/archive`,
    ];
    for (const p of archiveCandidates) {
      const r = await adeApiCall({
        method: "GET",
        path: p,
        binary: true,
        timeoutMs: 60000,
        accept: "application/zip, application/octet-stream, */*",
      });
      const ct = (r.headers["content-type"] ?? "").toLowerCase();
      if (
        r.status >= 200 &&
        r.status < 300 &&
        r.bodyBuffer &&
        (ct.includes("zip") || isZipBuffer(r.bodyBuffer))
      ) {
        const filename = `wiadomosc-${delivery.ade_message_id}.zip`;
        const storagePath = `${delivery.id}/archive-${delivery.ade_message_id}.zip`;
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(storagePath, r.bodyBuffer, { contentType: "application/zip", upsert: true });
        if (upErr) return { ok: false, error: upErr.message };
        return { ok: true, storagePath, filename };
      }
    }

    // 2) Fallback — zbuduj archiwum lokalnie z tego, co mamy w bazie/Storage + z evidences UA API.
    const JSZipMod = (await import("jszip")).default;
    const zip = new JSZipMod();
    const manifestFiles: Array<{ section: "attachment" | "evidence" | "confirmation" | "preview"; name: string; buf: Buffer }> = [];

    // 2a) TrescWiadomosci.txt
    const rawObj = (Array.isArray(delivery.raw) ? (delivery.raw as unknown[])[0] : delivery.raw ?? {}) as Record<string, unknown>;
    const bodyFromRaw =
      typeof rawObj.textBody === "string" ? (rawObj.textBody as string) :
      typeof rawObj.bodyText === "string" ? (rawObj.bodyText as string) : undefined;
    let body = bodyFromRaw ?? (delivery.body_text as string | null) ?? "";
    if (/^\s*[\[{]/.test(body)) body = ""; // stored JSON is not real content
    const bodyBuf = Buffer.from(body, "utf8");
    zip.file("TrescWiadomosci.txt", bodyBuf);
    const bodyHash = await hashFile(bodyBuf);

    // 2b) Załączniki (użytkownika) – pobierz ze Storage.
    const { data: atts } = await admin
      .from("edoreczenia_attachments")
      .select("filename, storage_path, mime_type")
      .eq("delivery_id", delivery.id);
    const attachmentEntries: Array<{ name: string; hash: string; algo: string }> = [];
    for (const a of atts ?? []) {
      if (!a.storage_path) continue;
      const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(a.storage_path);
      if (dErr || !file) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      // unikalna nazwa w ZIP (na wypadek duplikatów)
      let name = a.filename || "zalacznik";
      if (zip.file(name)) name = `${Date.now()}-${name}`;
      zip.file(name, buf);
      const h = await hashFile(buf);
      attachmentEntries.push({ name, hash: h.hash, algo: h.algo });
      manifestFiles.push({ section: "attachment", name, buf });
    }

    // 2c) Dowody techniczne + potwierdzenia biznesowe z UA API (BPWP/BPOP/UPD/UPP/PPSA-E-... .pdf)
    const evidenceEntries: Array<{ name: string; hash: string; algo: string }> = [];
    const confirmationEntries: Array<{ name: string; hash: string; algo: string }> = [];
    const previewEntries: Array<{ name: string; hash: string; algo: string }> = [];
    try {
      const listRes = await adeApiCall({ method: "GET", path: `${base}/evidences` });
      if (listRes.status >= 200 && listRes.status < 300) {
        const evList = normalizeEvidenceList(listRes.json);
        for (const e of evList) {
          const evId = firstString(e.evidenceId, e.id, e.uuid);
          if (!evId) continue;
          const encodedEvId = encodeURIComponent(evId);
          const messageTypes = [
            firstString(e.messageType, e.message_type, e.serviceType, e.shippingService),
            "Evidence",
            "evidence",
            "PURDE",
            "PUH",
          ].filter((v, idx, arr): v is string => !!v && arr.indexOf(v) === idx);
          const evCandidates = messageTypes.map(
            (mt) => `${mailboxBase}/evidences/${encodeURIComponent(mt)}/${encodedEvId}`,
          );
          for (const p of evCandidates) {
            const r = await adeApiCall({
              method: "GET",
              path: p,
              binary: true,
              timeoutMs: 60000,
              accept: "application/xml, application/pdf, application/octet-stream, */*",
            });
            if (!(r.status >= 200 && r.status < 300 && r.bodyBuffer && r.bodyBuffer.length > 0)) continue;
            const ct = (r.headers["content-type"] ?? "").toLowerCase();
            const head = r.bodyBuffer.slice(0, 8).toString("utf8").trim();
            if (ct.includes("application/json") || /^[\[{]/.test(head)) continue;
            const startsXml = head.startsWith("<");
            const startsPdf = r.bodyBuffer.slice(0, 4).toString("binary") === "%PDF";
            const ext = ct.includes("pdf") || startsPdf ? "pdf" : ct.includes("xml") || startsXml ? "xml" : "bin";
            const type = firstString(e.type, e.evidenceType, e.code) ?? "Dowod";
            // Nazwy plików spójne z biznes.gov (BPWP-/BPOP-/PPSA-E- prefiks + messageId).
            let filename: string;
            let section: "evidence" | "confirmation" | "preview" = "evidence";
            const upperType = type.toUpperCase();
            if (upperType.includes("BPWP") || upperType.includes("BPOP")) {
              filename = `${upperType}-${delivery.ade_message_id}.${ext}`;
              section = "confirmation";
            } else if (upperType.includes("PODGLAD") || upperType.includes("PREVIEW") || upperType.includes("PPSA")) {
              filename = `${delivery.ade_message_id}.${ext}`;
              section = "preview";
            } else {
              filename = `${type}_${evId}.${ext}`.replace(/[^\p{L}\p{N}._-]+/gu, "_");
              section = "evidence";
            }
            if (zip.file(filename)) filename = `${type}_${evId}.${ext}`.replace(/[^\p{L}\p{N}._-]+/gu, "_");
            zip.file(filename, r.bodyBuffer);
            const h = await hashFile(r.bodyBuffer);
            const entry = { name: filename, hash: h.hash, algo: h.algo };
            if (section === "confirmation") confirmationEntries.push(entry);
            else if (section === "preview") previewEntries.push(entry);
            else evidenceEntries.push(entry);
            manifestFiles.push({ section, name: filename, buf: r.bodyBuffer as Buffer });
            break;
          }
        }
      }
    } catch {
      /* dowody opcjonalne */
    }

    // 2d) MetrykaArchiwum.xml
    const nowIso = new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
    const listXml = (entries: Array<{ name: string; hash: string; algo: string }>) =>
      entries
        .map(
          (e) =>
            `    <Plik>\n      <NazwaPliku>${xmlEscape(e.name)}</NazwaPliku>\n      <WartoscSkrotu>${e.hash}</WartoscSkrotu>\n      <FunkcjaSkrotu>${e.algo}</FunkcjaSkrotu>\n    </Plik>`,
        )
        .join("\n");
    const metryka = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><SpecyfikacjaArchiwum wersja="1.0">
  <DataUtworzenia>${nowIso}</DataUtworzenia>
  <IdentyfikatorWiadomosci>${xmlEscape(delivery.ade_message_id)}</IdentyfikatorWiadomosci>
  <DaneZalaczniki>${attachmentEntries.length ? "\n" + listXml(attachmentEntries) + "\n  " : ""}</DaneZalaczniki>
  <TrescWiadomosci>
    <NazwaPliku>TrescWiadomosci.txt</NazwaPliku>
    <WartoscSkrotu>${bodyHash.hash}</WartoscSkrotu>
    <FunkcjaSkrotu>${bodyHash.algo}</FunkcjaSkrotu>
  </TrescWiadomosci>
  <DowodTechniczny>${evidenceEntries.length ? "\n" + listXml(evidenceEntries) + "\n  " : ""}</DowodTechniczny>
  <PotwierdzeniaBiznesowe>${confirmationEntries.length ? "\n" + listXml(confirmationEntries) + "\n  " : ""}</PotwierdzeniaBiznesowe>
  ${previewEntries.length ? `<PodgladWiadomosci>\n    <NazwaPliku>${xmlEscape(previewEntries[0].name)}</NazwaPliku>\n    <WartoscSkrotu>${previewEntries[0].hash}</WartoscSkrotu>\n    <FunkcjaSkrotu>${previewEntries[0].algo}</FunkcjaSkrotu>\n  </PodgladWiadomosci>` : `<PodgladWiadomosci/>`}
</SpecyfikacjaArchiwum>`;
    zip.file("MetrykaArchiwum.xml", metryka);

    const out = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
    const filename = `wiadomosc-${delivery.ade_message_id}.zip`;
    const storagePath = `${delivery.id}/archive-${delivery.ade_message_id}.zip`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, out, { contentType: "application/zip", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };
    // celowo NIE zapisuję do dedykowanej kolumny — używamy signed URL ad-hoc.
    void manifestFiles;
    return { ok: true, storagePath, filename };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}


// ─────────────────────────────── BAE search ──────────────────────────────────

export type BaeRecipientType = "PUBLIC" | "NON_PUBLIC" | "KOMORNIK" | "OSOBA_FIZYCZNA";
export type BaeIdentifierType = "EDELIVERY_ADDRESS" | "NIP" | "REGON" | "KRS" | "NAME";

export type BaeSearchResult = {
  address: string;
  name?: string;
  type?: string;
  nip?: string;
  regon?: string;
  krs?: string;
  city?: string;
  street?: string;
  postalCode?: string;
};

export type BaeSearchResponse = {
  ok: boolean;
  results: BaeSearchResult[];
  triedPaths: string[];
  error?: string;
};

function extractBaeItems(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const r = raw as Record<string, unknown>;
  for (const key of ["baeSearchData", "edaSearchData", "addresses", "items", "content", "results", "data", "entries"]) {
    const v = r[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}

function mapBaeItem(o: Record<string, unknown>): BaeSearchResult {
  const contrib = (o.contributor ??
    o.subjectData ??
    o.entity ??
    o.subject ??
    {}) as Record<string, unknown>;
  const addr = (o.recipientEda ??
    o.eDeliveryAddress ??
    o.edeliveryAddress ??
    o.address ??
    o.deliveryAddress) as string | undefined;
  const name =
    (contrib.entityName as string | undefined) ??
    (contrib.companyName as string | undefined) ??
    (contrib.name as string | undefined) ??
    (o.name as string | undefined) ??
    ([contrib.firstName, contrib.surname, contrib.lastName].filter(Boolean).join(" ") || undefined);
  const type =
    (o.entityType as string | undefined) ??
    (o.type as string | undefined) ??
    (contrib.type as string | undefined);
  // SE API zwraca addressList (tablica) — bierzemy pierwszy adres MAIN, inaczej pierwszy.
  const addressList = (o.addressList as Record<string, unknown>[] | undefined) ?? [];
  const mainAddr =
    addressList.find((a) => String(a.addressType).toUpperCase() === "MAIN") ?? addressList[0];
  const address = (mainAddr ??
    o.addressDetails ??
    contrib.address ??
    {}) as Record<string, unknown>;
  const officialIds = (contrib.officialIds ?? {}) as Record<string, unknown>;
  return {
    address: String(addr ?? ""),
    name,
    type,
    nip:
      (officialIds.nip as string | undefined) ??
      (contrib.nip as string | undefined) ??
      (o.nip as string | undefined),
    regon:
      (officialIds.regon as string | undefined) ??
      (contrib.regon as string | undefined) ??
      (o.regon as string | undefined),
    krs:
      (officialIds.krs as string | undefined) ??
      (contrib.krs as string | undefined) ??
      (o.krs as string | undefined),
    city: (address.city as string | undefined) ?? (address.town as string | undefined),
    street:
      [address.street as string | undefined, address.buildingNumber as string | undefined]
        .filter(Boolean)
        .join(" ") ||
      (address.streetName as string | undefined),
    postalCode: (address.postalCode as string | undefined) ?? (address.zipCode as string | undefined),
  };
}

export type BaeAddressInput = {
  entityName?: string;
  countryCode?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  buildingNumber?: string;
  flatNumber?: string;
};

export type BaeSearchInputServer = {
  recipientType: BaeRecipientType;
  identifierType: BaeIdentifierType;
  value: string;
  limit?: number;
  address?: BaeAddressInput;
};

/** Mapa typu odbiorcy → lista kandydatów searchCategory.
 *  SE API v4 używa wartości z dokumentacji technicznej: PUBLIC_INSTITUTION, COMPANY,
 *  ORGANISATION, COURT_ENFORCEMENT_OFFICER, INDIVIDUAL. Starsze/pośrednie wartości
 *  zostawiamy wyłącznie jako fallback, bo bramki OW potrafią różnić się wersją kontraktu.
 */
function searchCategoryCandidates(rt: BaeRecipientType): string[] {
  switch (rt) {
    case "PUBLIC":
      return [
        "PUBLIC_INSTITUTION",
        "PUBLIC",
        "PUBLIC_ENTITY",
        "PUBLIC_ADMINISTRATION_BODY",
      ];
    case "NON_PUBLIC":
      return [
        "COMPANY",
        "ORGANISATION",
        "NON_PUBLIC",
        "NON_PUBLIC_ENTITY",
      ];
    case "KOMORNIK":
      return [
        "COURT_ENFORCEMENT_OFFICER",
        "TRUSTED_NON_PUBLIC",
        "TRUSTED_NON_PUBLIC_ENTITY",
        "KOMORNIK",
      ];
    case "OSOBA_FIZYCZNA":
      return [
        "INDIVIDUAL",
        "NATURAL_PERSON",
        "INDIVIDUAL_PERSON",
        "PERSON",
      ];
  }
}

// In-memory cache: pierwsza wartość enuma, która nie zwraca 00003.
const searchCategoryCache = new Map<BaeRecipientType, string>();

function isEnumError(bodyStr: string): boolean {
  return (
    /"errorCode"\s*:\s*"?0*00003"?/i.test(bodyStr) ||
    /SEAPI-?00003/i.test(bodyStr) ||
    /Search Category provided is invalid/i.test(bodyStr) ||
    /Incorrect enum value/i.test(bodyStr) ||
    /not one of the values accepted for Enum/i.test(bodyStr)
  );
}

/**
 * Wyszukaj adresata w Bazie Adresów Elektronicznych (BAE) przez SE API OW.
 * POST /api/se/v3/search/{bae_search|eda_search}, bearer token (bez mTLS).
 */
export async function searchBae(input: BaeSearchInputServer): Promise<BaeSearchResponse> {
  const cfg = loadAdeConfig();
  const val = input.value.trim();
  if (!val && input.identifierType !== "NAME") {
    return { ok: false, results: [], triedPaths: [], error: "Podaj wartość do wyszukania" };
  }

  const token = await getAdeAccessToken();
  const { adeSeRawRequest } = await import("@/lib/ade-client.server");
  const senderEda = cfg.mailboxAddress;
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);

  const scenario: "eda" | "bae" = input.identifierType === "EDELIVERY_ADDRESS" ? "eda" : "bae";

  const officialIds: Record<string, string> = {};
  if (input.identifierType === "NIP") officialIds.nip = val;
  if (input.identifierType === "REGON") officialIds.regon = val;
  if (input.identifierType === "KRS") officialIds.krs = val;

  const addr = input.address ?? {};
  const address: Record<string, string> | undefined =
    input.identifierType === "NAME"
      ? {
          countryCode: addr.countryCode?.trim() || "PL",
          ...(addr.city?.trim() ? { city: addr.city.trim() } : {}),
          ...(addr.postalCode?.trim() ? { postalCode: addr.postalCode.trim() } : {}),
          ...(addr.street?.trim() ? { street: addr.street.trim() } : {}),
          ...(addr.buildingNumber?.trim() ? { buildingNumber: addr.buildingNumber.trim() } : {}),
          ...(addr.flatNumber?.trim() ? { flatNumber: addr.flatNumber.trim() } : {}),
        }
      : undefined;

  const entityName =
    input.identifierType === "NAME" ? (addr.entityName?.trim() || val) : undefined;

  const buildBody = (category: string, categoryAsArray: boolean): Record<string, unknown> =>
    scenario === "eda"
      ? { senderEda, recipientEdas: [val.toUpperCase()], offset: 0, limit }
      : {
          senderEda,
          recipientEdasOnly: false,
          searchCategory: categoryAsArray ? [category] : category,
          ...(entityName ? { entityName } : {}),
          ...(Object.keys(officialIds).length ? { officialIds } : {}),
          ...(address ? { address } : {}),
          offset: 0,
          limit,
        };

  const path =
    scenario === "eda" ? "/api/se/v3/search/eda_search" : "/api/se/v3/search/bae_search";
  const pathCandidates =
    scenario === "eda"
      ? [path, path.replace("/api/se/v3/", "/api/se/v4/")]
      : [path.replace("/api/se/v3/", "/api/se/v4/"), path];

  const cached = searchCategoryCache.get(input.recipientType);
  const categoryCandidates =
    scenario === "eda"
      ? [""]
      : cached
        ? [cached, ...searchCategoryCandidates(input.recipientType).filter((c) => c !== cached)]
        : searchCategoryCandidates(input.recipientType);

  const tried: string[] = [];
  let lastError: string | undefined;

  for (const p of pathCandidates) {
    let pathBroken = false;
    let sawOnlyEnumErrors = false;
    let stopPath = false;
    for (const category of categoryCandidates) {
      if (pathBroken || stopPath) break;
      const categoryShapes = scenario === "bae" ? [false, true] : [false];
      for (const categoryAsArray of categoryShapes) {
        if (pathBroken || stopPath) break;
        const label =
          scenario === "bae"
            ? `POST ${p} [${category}${categoryAsArray ? "[]" : ""}]`
            : `POST ${p}`;
        tried.push(label);
        try {
          const res = await adeSeRawRequest({
            method: "POST",
            path: p,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(buildBody(category, categoryAsArray)),
            timeoutMs: 20000,
          });
          const bodyStr = res.body ?? "";
          if ((res.status === 404 && !/SEAPI-00010/i.test(bodyStr)) || res.status === 405) {
            pathBroken = true;
            break;
          }
          let json: unknown = null;
          try {
            json = bodyStr ? JSON.parse(bodyStr) : null;
          } catch {
            /* pusto */
          }
          if (res.status >= 200 && res.status < 300) {
            if (scenario === "bae" && category)
              searchCategoryCache.set(input.recipientType, category);
            const arr = extractBaeItems(json);
            const items = arr.map(mapBaeItem).filter((r) => !!r.address);
            return { ok: true, results: items, triedPaths: tried };
          }
          if (res.status === 404 && /SEAPI-00010/i.test(bodyStr)) {
            return { ok: true, results: [], triedPaths: tried };
          }
          // Enum error → spróbuj kolejnego kandydata/formatu dla tej ścieżki
          if (scenario === "bae" && isEnumError(bodyStr)) {
            sawOnlyEnumErrors = true;
            lastError = `HTTP ${res.status}: ${bodyStr.slice(0, 300)}`;
            continue;
          }
          lastError = `HTTP ${res.status}: ${bodyStr.slice(0, 300)}`;
          stopPath = true;
        } catch (err) {
          lastError = (err as Error).message;
          stopPath = true;
        }
      }
    }
    if (!pathBroken && !sawOnlyEnumErrors) break; // ścieżka odpowiedziała czymś innym niż błąd enuma
  }

  return {
    ok: false,
    results: [],
    triedPaths: tried,
    error: lastError ?? "Endpoint SE API (BAE) nie odpowiada",
  };
}


