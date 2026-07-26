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

/** Zwraca listę wiadomości ze skrzynki (limit ustawia klient).
 *  Dla folderów innych niż INBOX próbuje kilku wariantów ścieżki/parametrów
 *  UA API v3, bo różne wdrożenia obsługują je inaczej. Pierwszy 2xx wygrywa.
 */
export async function listAdeInboxRaw(params: { limit?: number; page?: number; folder?: AdeFolder } = {}) {
  const cfg = loadAdeConfig();
  const folder: AdeFolder = params.folder ?? "INBOX";
  const mailboxBase = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}`;
  const messagesBase = `${mailboxBase}/messages`;
  const draftsBase = `${mailboxBase}/drafts`;
  const limit = params.limit ?? 50;
  const page = params.page ?? 0;
  const offset = page * limit;

  type Attempt = { path: string; query?: Record<string, string | number | undefined> };
  const attempts: Attempt[] = [];
  if (folder === "INBOX") {
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "INBOX" } });
    attempts.push({ path: messagesBase, query: { limit, page, format: "metadata", label: "INBOX" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "INBOX" } });
    attempts.push({ path: `${messagesBase}/received`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata" } });
  } else if (folder === "SENT") {
    // Wariantów szukamy tak samo jak dla DRAFTS: najpierw dedykowana ścieżka, potem query label/folder/box.
    attempts.push({ path: `${messagesBase}/sent`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: `${messagesBase}/outbox`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "SENT" } });
    attempts.push({ path: messagesBase, query: { limit, page, format: "metadata", label: "SENT" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "OUTBOX" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "SENT" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "OUTBOX" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", box: "SENT" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", type: "SENT" } });
  } else if (folder === "DRAFTS") {
    // UA API v3: DRAFTS nie wolno pobierać przez /messages; mają osobny endpoint /drafts.
    attempts.push({ path: draftsBase, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: draftsBase, query: { limit, page, format: "metadata" } });
    attempts.push({ path: draftsBase, query: { limit, offset } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "DRAFTS" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "DRAFTS" } });
  } else if (folder === "TRASH") {
    attempts.push({ path: `${messagesBase}/trash`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: `${messagesBase}/deleted`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: `${messagesBase}/bin`, query: { limit, offset, format: "metadata" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "TRASH" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "DELETED" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", label: "BIN" } });
    attempts.push({ path: messagesBase, query: { limit, page, format: "metadata", label: "TRASH" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "TRASH" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", folder: "DELETED" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", box: "TRASH" } });
    attempts.push({ path: messagesBase, query: { limit, offset, format: "metadata", type: "TRASH" } });
  }

  // Etykiety oczekiwane dla danego folderu (używane do walidacji odpowiedzi).
  const wantedLabels: Record<AdeFolder, string[]> = {
    INBOX: ["INBOX", "RECEIVED", "IN"],
    SENT: ["SENT", "OUTBOX", "OUT"],
    DRAFTS: ["DRAFT", "DRAFTS"],
    TRASH: ["TRASH", "DELETED", "BIN"],
  };
  const itemLabels = (o: Record<string, unknown>): string[] => {
    const meta = (o.messageMetadata ?? o.metadata ?? {}) as Record<string, unknown>;
    const single = String(
      (meta.label ?? meta.folder ?? meta.box ?? meta.mailboxFolder ?? o.label ?? o.folder ?? "") as string,
    ).toUpperCase();
    const many = Array.isArray(meta.labels)
      ? (meta.labels as unknown[]).map((x) => String(x).toUpperCase())
      : [];
    return [single, ...many].filter(Boolean);
  };
  const itemMatchesFolder = (o: Record<string, unknown>, f: AdeFolder): boolean => {
    const labels = itemLabels(o);
    if (labels.length === 0) return false;
    return wantedLabels[f].some((w) => labels.includes(w));
  };

  let last: Awaited<ReturnType<typeof adeApiCall>> | null = null;
  let firstSuccessEmpty: Awaited<ReturnType<typeof adeApiCall>> | null = null;
  for (const a of attempts) {
    const res = await adeApiCall({ method: "GET", path: a.path, query: a.query });
    last = res;
    if (res.status >= 200 && res.status < 300) {
      const items = extractRawItems(res.json);
      if (items.length === 0) {
        if (!firstSuccessEmpty) firstSuccessEmpty = res;
        continue;
      }
      // Dla INBOX — brak filtra (domyślna odpowiedź).
      // Dla dedykowanych ścieżek folderowych ufamy odpowiedzi bez sprawdzania etykiet.
      const isDedicatedPath = /\/(sent|outbox|drafts|trash|deleted|bin)(\/|$)/i.test(a.path);
      if (folder === "INBOX" || isDedicatedPath) return res;
      // Dla ogólnego `/messages` z parametrem label/folder/box — zwaliduj etykiety,
      // bo wiele wdrożeń UA API ignoruje nieznane parametry i zwraca INBOX.
      const filtered = items.filter((o) => itemMatchesFolder(o, folder));
      if (filtered.length > 0) {
        return {
          status: res.status,
          body: JSON.stringify({ messages: filtered }),
          bodyBuffer: undefined,
          json: { messages: filtered } as unknown,
          headers: res.headers,
        };
      }
      if (!firstSuccessEmpty) firstSuccessEmpty = res;
    }
  }
  // Fallback dla SENT/TRASH: pobierz WSZYSTKIE wiadomości bez filtra i przefiltruj po metadanych.
  if (folder === "SENT" || folder === "TRASH") {
    const all = await adeApiCall({
      method: "GET",
      path: messagesBase,
      query: { limit: Math.max(limit * 4, 200), offset: 0, format: "metadata" },
    });
    if (all.status >= 200 && all.status < 300) {
      const items = extractRawItems(all.json);
      const filtered = items.filter((o) => itemMatchesFolder(o, folder));
      return {
        status: 200,
        body: JSON.stringify({ messages: filtered }),
        bodyBuffer: undefined,
        json: { messages: filtered } as unknown,
        headers: all.headers,
      };
    }
  }
  // Nic nie pasuje — zwróć pustą listę zamiast surowej (potencjalnie INBOX) odpowiedzi.
  if (firstSuccessEmpty) {
    return {
      status: 200,
      body: JSON.stringify({ messages: [] }),
      bodyBuffer: undefined,
      json: { messages: [] } as unknown,
      headers: firstSuccessEmpty.headers,
    };
  }
  return last!;
}

export async function getAdeMessageRaw(messageId: string) {
  const cfg = loadAdeConfig();
  const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/messages/${encodeURIComponent(messageId)}`;
  return await adeApiCall({ method: "GET", path });
}

export async function getAdeDraftRaw(messageId: string) {
  const cfg = loadAdeConfig();
  const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/drafts/${encodeURIComponent(messageId)}`;
  return await adeApiCall({ method: "GET", path, query: { format: "full" } });
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
      (meta.timestamp as string | undefined) ??
      (o.creationDate as string | undefined) ??
      (o.timestamp as string | undefined);
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

/** Pobierz listę wiadomości z ADE (per folder) i upsertuj do public.edoreczenia_deliveries.
 *  Sync jest realizowany osobno per folder: INBOX / SENT / DRAFTS / TRASH.
 *  Dla folderów innych niż INBOX używamy alternatywnych ścieżek UA API (patrz listAdeInboxRaw).
 *  Wiersze upsertujemy z folderem = requestedFolder, żeby API było źródłem prawdy.
 */
export async function syncInboxToDb(params: { limit?: number; folder?: AdeFolder } = {}): Promise<SyncSummary> {
  const cfg = loadAdeConfig();
  const requestedFolder: AdeFolder = params.folder ?? "INBOX";
  const summary: SyncSummary = { ok: false, mailbox: cfg.mailboxAddress, fetched: 0, inserted: 0, updated: 0 };
  try {
    const res = await listAdeInboxRaw({ limit: params.limit ?? 100, folder: requestedFolder });
    if (!res || res.status < 200 || res.status >= 300) {
      // Jeśli API nie wspiera danego folderu (np. DRAFTS w niektórych wdrożeniach),
      // zwracamy ok=true bez zmian, żeby UI nie pokazywał błędu.
      const status = res?.status ?? 0;
      if (status === 404 || status === 400 || status === 405 || status === 501) {
        const admin = await getAdmin();
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
      }
      summary.error = `HTTP ${status}`;
      return summary;
    }
    const rawItems = extractRawItems(res.json);
    const normalized = normalizeInboxItems(res.json);
    summary.fetched = rawItems.length;

    const defaultDirection = requestedFolder === "SENT" || requestedFolder === "DRAFTS" ? "outbound" : "inbound";
    const admin = await getAdmin();
    const missingDetails: string[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const n = normalized[i];
      if (!n.id) continue;
      const { data: existing } = await admin
        .from("edoreczenia_deliveries")
        .select("id, subject, body_text, folder")
        .eq("ade_message_id", n.id)
        .maybeSingle();
      const bodyText = typeof (raw as { textBody?: unknown }).textBody === "string"
        ? ((raw as { textBody: string }).textBody)
        : typeof (raw as { bodyText?: unknown }).bodyText === "string"
          ? ((raw as { bodyText: string }).bodyText)
          : null;
      // Wyprowadź kierunek per-wiadomość: gdy nadawcą jest nasza skrzynka → outbound.
      const isOutboundByFrom = !!n.from && n.from === cfg.mailboxAddress;
      const direction = isOutboundByFrom ? "outbound" : defaultDirection;
      const baseRow: Record<string, unknown> = {
        direction,
        ade_message_id: n.id,
        mailbox_address: cfg.mailboxAddress,
        from_address: n.from ?? (direction === "outbound" ? cfg.mailboxAddress : null),
        to_address: n.to ?? (direction === "inbound" ? cfg.mailboxAddress : null),
        subject: n.subject ?? null,
        received_at: n.receivedAt ?? null,
        creation_date: (n as { creationDate?: string }).creationDate ?? null,
        sent_at: (n as { sentAt?: string }).sentAt ?? null,
        status: n.status ?? "new",
        raw,
        body_text: bodyText,
        updated_at: new Date().toISOString(),
      };

      let deliveryId: string;
      if (existing?.id) {
        // API zwróciło tę wiadomość w tym folderze — traktujemy API jako źródło prawdy.
        const patch: Record<string, unknown> = { ...baseRow, folder: requestedFolder };
        if (!n.subject && existing.subject) delete patch.subject;
        if (!bodyText && existing.body_text) delete patch.body_text;
        await admin.from("edoreczenia_deliveries").update(patch).eq("id", existing.id);
        deliveryId = existing.id as string;
        summary.updated++;
      } else {
        const { data: inserted } = await admin
          .from("edoreczenia_deliveries")
          .insert({ ...baseRow, folder: requestedFolder })
          .select("id")
          .maybeSingle();
        deliveryId = inserted?.id as string;
        summary.inserted++;
      }

      const needsDetail = !n.subject || !bodyText;
      if (deliveryId && needsDetail) missingDetails.push(deliveryId);
    }

    // Doczytaj szczegóły równolegle, ale z małym limitem żeby nie zalać UA API.
    const CONCURRENCY = 3;
    for (let i = 0; i < missingDetails.length; i += CONCURRENCY) {
      const chunk = missingDetails.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((id) => fetchAndStoreMessage(id, false).catch(() => null)));
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

/** Pobierz treść wiadomości z ADE, zapisz body_text i załączniki do Storage/DB.
 *  `markRead` — czy ustawić read_at (domyślnie true = otwarcie w UI). */
export async function fetchAndStoreMessage(deliveryId: string, markRead = true): Promise<{
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
      .select("id, ade_message_id, mailbox_address, folder")
    .eq("id", deliveryId)
    .maybeSingle();
  if (dErr || !delivery) return { ok: false, attachments: [], error: "Nie znaleziono wiadomości w bazie" };
  if (!delivery.ade_message_id) return { ok: false, attachments: [], error: "Brak ade_message_id" };

  try {
    await ensureEdoreczeniaBucket();
    const cfg = loadAdeConfig();
    const messageKind = delivery.folder === "DRAFTS" ? "drafts" : "messages";
    const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/${messageKind}/${encodeURIComponent(delivery.ade_message_id)}`;
    const res = await adeApiCall({ method: "GET", path, query: { format: "full" } });
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
          : typeof ((payload.messageContent as Record<string, unknown> | undefined)?.textBody) === "string"
            ? (((payload.messageContent as Record<string, unknown>).textBody) as string)
            : "";
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
      updated_at: new Date().toISOString(),
    };
    if (markRead) update.read_at = new Date().toISOString();
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
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

// ────────────────────── Zapis roboczej (Draft) ──────────────────────

export type SaveAdeDraftInput = SendAdeMessageInput & { draftId?: string };
export type SaveAdeDraftResult = {
  ok: boolean;
  draftId?: string;
  remote: boolean;
  error?: string;
  attempts?: Array<{ path: string; status: number; snippet: string }>;
};

/** Zapisz wiadomość jako roboczą.
 *  Próbuje utworzyć/zaktualizować draft w UA API v3 (`/drafts`).
 *  Niezależnie od wyniku – zapisuje kopię lokalnie w folderze DRAFTS.
 */
export async function saveAdeDraft(input: SaveAdeDraftInput): Promise<SaveAdeDraftResult> {
  const cfg = loadAdeConfig();
  const mailbox = cfg.mailboxAddress;
  const recipients = (input.recipients ?? []).map((r) => r.trim()).filter(Boolean);
  if (!input.subject?.trim() && !input.bodyText?.trim() && recipients.length === 0) {
    return { ok: false, remote: false, error: "Pusta wiadomość" };
  }

  const attachments = (input.attachments ?? []).map((a) => ({
    filename: a.filename,
    mimeType: a.mimeType ?? "application/octet-stream",
    content: a.contentBase64,
  }));

  const commonMeta = {
    from: [{ eDeliveryAddress: mailbox }],
    to: recipients.map((address) => ({ eDeliveryAddress: address })),
    subject: input.subject?.trim() || "(bez tematu)",
    caseIdentifier: input.caseNumber?.trim() || undefined,
  };

  const payloads: Array<{ label: string; body: Record<string, unknown> }> = [
    { label: "v3-nested", body: { messageMetadata: commonMeta, textBody: input.bodyText ?? "", attachments } },
    {
      label: "v3-flat",
      body: {
        from: mailbox,
        to: recipients,
        subject: commonMeta.subject,
        textBody: input.bodyText ?? "",
        caseIdentifier: input.caseNumber?.trim() || undefined,
        attachments,
      },
    },
  ];

  const paths = input.draftId
    ? [`/api/v3/${encodeURIComponent(mailbox)}/drafts/${encodeURIComponent(input.draftId)}`]
    : [
        `/api/v3/${encodeURIComponent(mailbox)}/drafts`,
        `/api/v3/${encodeURIComponent(mailbox)}/messages/drafts`,
      ];

  const attempts: Array<{ path: string; status: number; snippet: string }> = [];
  let remoteDraftId: string | undefined;
  let remoteOk = false;
  for (const path of paths) {
    for (const p of payloads) {
      const res = await adeApiCall({
        method: input.draftId ? "PUT" : "POST",
        path,
        body: p.body,
        timeoutMs: 60000,
      });
      attempts.push({ path: `${path} [${p.label}]`, status: res.status, snippet: res.body.slice(0, 200) });
      if (res.status >= 200 && res.status < 300) {
        const j = (Array.isArray(res.json) ? res.json[0] : res.json) as Record<string, unknown> | null;
        const meta = ((j?.messageMetadata ?? {}) as Record<string, unknown>) || {};
        remoteDraftId =
          (meta.messageId as string | undefined) ??
          (j?.messageId as string | undefined) ??
          (j?.id as string | undefined) ??
          input.draftId;
        remoteOk = true;
        break;
      }
      if (res.status !== 400 && res.status !== 415 && res.status !== 422) break;
    }
    if (remoteOk) break;
  }

  const admin = await getAdmin();
  const localAdeId = remoteDraftId ?? input.draftId ?? `local-draft-${Date.now()}`;
  const rawSnap = {
    messageMetadata: commonMeta,
    textBody: input.bodyText ?? "",
    _local: !remoteOk,
    _savedAt: new Date().toISOString(),
  };
  const { error: upErr } = await admin
    .from("edoreczenia_deliveries")
    .upsert(
      {
        mailbox_address: mailbox,
        ade_message_id: localAdeId,
        folder: "DRAFTS",
        from_address: mailbox,
        to_address: recipients[0] ?? null,
        subject: commonMeta.subject,
        body_text: input.bodyText ?? "",
        creation_date: new Date().toISOString(),
        raw: rawSnap as unknown as Record<string, unknown>,
      },
      { onConflict: "mailbox_address,ade_message_id" },
    );
  if (upErr) return { ok: false, remote: remoteOk, draftId: remoteDraftId, error: upErr.message, attempts };
  return { ok: true, remote: remoteOk, draftId: remoteDraftId, attempts };
}

// ────────────────────── Usunięcie wiadomości (ADE + lokalnie) ──────────────────────

export type DeleteAdeResult = {
  ok: boolean;
  remote: boolean;
  local: boolean;
  hardDeleted: boolean;
  error?: string;
  attempts?: Array<{ path: string; method: string; status: number; snippet: string }>;
};

/** Usuń wiadomość w UA API (biznes.gov) i lokalnie.
 *  INBOX/SENT/DRAFTS → przenieś do kosza (soft delete). TRASH lub hardDelete → usuń trwale.
 */
export async function deleteAdeDelivery(
  deliveryId: string,
  opts: { hardDelete?: boolean } = {},
): Promise<DeleteAdeResult> {
  const admin = await getAdmin();
  const { data: row } = await admin
    .from("edoreczenia_deliveries")
    .select("id, ade_message_id, folder, mailbox_address")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!row)
    return { ok: false, remote: false, local: false, hardDeleted: false, error: "Nie znaleziono wiadomości" };

  const cfg = loadAdeConfig();
  const mailbox = row.mailbox_address ?? cfg.mailboxAddress;
  const adeId = row.ade_message_id ?? "";
  const folder = (row.folder as AdeFolder | null) ?? "INBOX";
  const hardDelete = opts.hardDelete || folder === "TRASH";
  const attempts: Array<{ path: string; method: string; status: number; snippet: string }> = [];
  let remoteOk = false;

  if (adeId && !adeId.startsWith("local-")) {
    const base = `/api/v3/${encodeURIComponent(mailbox)}`;
    const mid = encodeURIComponent(adeId);
    const candidates: Array<{ method: string; path: string; body?: unknown }> = [];
    if (folder === "DRAFTS") {
      candidates.push({ method: "DELETE", path: `${base}/drafts/${mid}` });
    }
    if (hardDelete) {
      candidates.push({ method: "DELETE", path: `${base}/trash/${mid}` });
      candidates.push({ method: "DELETE", path: `${base}/messages/${mid}?permanent=true` });
      candidates.push({ method: "DELETE", path: `${base}/messages/${mid}` });
    } else {
      candidates.push({ method: "DELETE", path: `${base}/messages/${mid}` });
      candidates.push({ method: "POST", path: `${base}/messages/${mid}/trash` });
      candidates.push({ method: "PUT", path: `${base}/messages/${mid}/label`, body: { label: "TRASH" } });
    }
    for (const c of candidates) {
      const res = await adeApiCall({ method: c.method, path: c.path, body: c.body });
      attempts.push({ method: c.method, path: c.path, status: res.status, snippet: res.body.slice(0, 200) });
      if (res.status >= 200 && res.status < 300) {
        remoteOk = true;
        break;
      }
      if (res.status === 401 || res.status === 403) break;
    }
  } else {
    remoteOk = true; // wpis tylko lokalny
  }

  let localOk = true;
  if (hardDelete) {
    const { data: atts } = await admin
      .from("edoreczenia_attachments")
      .select("id, storage_path")
      .eq("delivery_id", row.id);
    const paths = (atts ?? []).map((a) => a.storage_path).filter((v): v is string => !!v);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths).catch(() => undefined);
    await admin.from("edoreczenia_attachments").delete().eq("delivery_id", row.id);
    const { error } = await admin.from("edoreczenia_deliveries").delete().eq("id", row.id);
    if (error) localOk = false;
  } else {
    const { error } = await admin.from("edoreczenia_deliveries").update({ folder: "TRASH" }).eq("id", row.id);
    if (error) localOk = false;
  }

  return {
    ok: remoteOk && localOk,
    remote: remoteOk,
    local: localOk,
    hardDeleted: hardDelete,
    error: !remoteOk
      ? `Nie udało się usunąć w ADE (HTTP ${attempts[attempts.length - 1]?.status ?? "?"})`
      : !localOk
        ? "Nie udało się usunąć lokalnie"
        : undefined,
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

export type BaeRecipientType = "ALL" | "PUBLIC" | "NON_PUBLIC" | "KOMORNIK" | "OSOBA_FIZYCZNA";
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
  headquartersAddress?: string;
  correspondenceAddress?: string;
};

export type BaeSearchResponse = {
  ok: boolean;
  results: BaeSearchResult[];
  triedPaths: string[];
  error?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickString(o: unknown, keys: string[]): string | undefined {
  if (!isRecord(o)) return undefined;
  for (const key of keys) {
    const value = firstString(o[key]);
    if (value) return value;
  }
  return undefined;
}

function looksLikeEdeliveryAddress(value: string): boolean {
  return /^AE:[A-Z]{2}[A-Z0-9._:-]+$/i.test(value.trim());
}

function findEdeliveryAddress(raw: unknown, depth = 0): string | undefined {
  if (!raw || depth > 6) return undefined;
  if (typeof raw === "string") {
    const exact = raw.trim();
    if (looksLikeEdeliveryAddress(exact)) return exact;
    const match = exact.match(/AE:[A-Z]{2}[A-Z0-9._:-]+/i);
    return match?.[0];
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = findEdeliveryAddress(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(raw)) return undefined;
  const direct = pickString(raw, [
    "recipientEda",
    "recipientEDA",
    "recipientEdaAddress",
    "recipientAddress",
    "eDeliveryAddress",
    "eDeliveryAddressValue",
    "edeliveryAddress",
    "electronicDeliveryAddress",
    "eda",
    "ade",
    "ADE",
    "address",
    "value",
  ]);
  if (direct && looksLikeEdeliveryAddress(direct)) return direct;
  for (const key of [
    "recipientEda",
    "recipientEdas",
    "recipientEdaList",
    "eDeliveryAddresses",
    "electronicDeliveryAddresses",
    "addresses",
    "deliveryAddress",
    "edaData",
    "edaSearchData",
    "baeSearchData",
  ]) {
    const found = findEdeliveryAddress(raw[key], depth + 1);
    if (found) return found;
  }
  return undefined;
}

function looksLikeBaeItem(o: Record<string, unknown>): boolean {
  return !!(
    findEdeliveryAddress(o) ||
    o.contributor ||
    o.subjectData ||
    o.entityName ||
    o.companyName ||
    o.officialIds ||
    o.addressList ||
    o.recipientEda ||
    o.eDeliveryAddress
  );
}

function extractBaeItems(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (!raw || depth > 6) return [];
  if (Array.isArray(raw)) {
    const records = raw.filter(isRecord);
    const hits = records.filter(looksLikeBaeItem);
    if (hits.length) return hits;
    return raw.flatMap((item) => extractBaeItems(item, depth + 1));
  }
  if (!isRecord(raw)) return [];
  for (const key of [
    "baeSearchData",
    "edaSearchData",
    "recipientEdaSearchData",
    "recipientEdas",
    "searchResults",
    "addresses",
    "items",
    "content",
    "results",
    "data",
    "entries",
  ]) {
    const items = extractBaeItems(raw[key], depth + 1);
    if (items.length) return items;
  }
  if (looksLikeBaeItem(raw)) return [raw];
  for (const value of Object.values(raw)) {
    const items = extractBaeItems(value, depth + 1);
    if (items.length) return items;
  }
  return [];
}

function findOfficialId(raw: unknown, registry: "nip" | "regon" | "krs"): string | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const ref = firstString(item.referenceRegistry, item.registry, item.type, item.name)?.toLowerCase();
      if (ref === registry) {
        const id = pickString(item, ["id", "value", "identifier", "number"]);
        if (id) return id;
      }
    }
    return undefined;
  }
  if (!isRecord(raw)) return undefined;
  const direct = pickString(raw, [registry, registry.toUpperCase()]);
  if (direct) return direct;
  return findOfficialId(raw.officialIds, registry);
}

function formatAddressLine(a: Record<string, unknown>): string {
  const street = firstString(a.street, a.streetName);
  const building = firstString(a.buildingNumber, a.houseNumber);
  const flat = firstString(a.flatNumber, a.apartmentNumber);
  const postal = firstString(a.postalCode, a.zipCode);
  const city = firstString(a.city, a.town);
  const streetPart = [street, [building, flat].filter(Boolean).join("/")].filter(Boolean).join(" ").trim();
  const cityPart = [postal, city].filter(Boolean).join(" ").trim();
  return [streetPart, cityPart].filter(Boolean).join(", ").toUpperCase();
}

function addressTypeTokens(a: Record<string, unknown>): string[] {
  const t = a.addressType ?? a.type;
  if (Array.isArray(t)) return t.map((x) => String(x).toUpperCase());
  if (t) return [String(t).toUpperCase()];
  return [];
}

function collectRecords(raw: unknown, depth = 0, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!raw || depth > 8) return acc;
  if (Array.isArray(raw)) {
    for (const item of raw) collectRecords(item, depth + 1, acc);
    return acc;
  }
  if (isRecord(raw)) {
    acc.push(raw);
    for (const v of Object.values(raw)) collectRecords(v, depth + 1, acc);
  }
  return acc;
}

function findFirstStringByKeys(records: Record<string, unknown>[], keys: string[]): string | undefined {
  for (const r of records) {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
  }
  return undefined;
}

function collectAddressRecords(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const r of records) {
    for (const k of ["addressList", "addresses", "addressData", "addressesList"]) {
      const v = r[k];
      if (Array.isArray(v)) for (const x of v) if (isRecord(x)) out.push(x);
    }
    for (const k of ["address", "addressDetails", "correspondenceAddress", "headquartersAddress", "seatAddress"]) {
      const v = r[k];
      if (isRecord(v)) out.push({ ...v, addressType: v.addressType ?? v.type ?? k });
    }
  }
  return out;
}

function mapBaeItem(o: Record<string, unknown>): BaeSearchResult {
  const records = collectRecords(o);
  const addr = findEdeliveryAddress(o);

  const name = findFirstStringByKeys(records, [
    "entityName",
    "companyName",
    "institutionName",
    "organizationName",
    "subjectName",
    "fullName",
    "displayName",
    "name",
  ]) ?? (() => {
    const first = findFirstStringByKeys(records, ["firstName", "givenName", "name"]);
    const last = findFirstStringByKeys(records, ["surname", "lastName", "familyName"]);
    const joined = [first, last].filter(Boolean).join(" ").trim();
    return joined || undefined;
  })();

  const type = findFirstStringByKeys(records, ["entityType", "subjectType", "recipientType", "type"]);

  const addressList = collectAddressRecords(records);
  const headquartersAddr = addressList.find((a) => addressTypeTokens(a).some((x) => /HEADQUARTER|MAIN|SIEDZIB|SEAT/i.test(x)));
  const correspondenceAddr = addressList.find((a) => addressTypeTokens(a).some((x) => /CORRESPOND|KORESPOND/i.test(x)));
  const fallback = addressList[0];
  const primary = headquartersAddr ?? fallback ?? {};

  let nip: string | undefined;
  let regon: string | undefined;
  let krs: string | undefined;
  for (const r of records) {
    nip ??= findOfficialId(r.officialIds, "nip") ?? pickString(r, ["nip", "NIP"]);
    regon ??= findOfficialId(r.officialIds, "regon") ?? pickString(r, ["regon", "REGON"]);
    krs ??= findOfficialId(r.officialIds, "krs") ?? pickString(r, ["krs", "KRS"]);
    if (nip && regon && krs) break;
  }

  return {
    address: String(addr ?? ""),
    name,
    type,
    nip,
    regon,
    krs,
    city: firstString(primary.city, primary.town),
    street:
      [firstString(primary.street, primary.streetName), firstString(primary.buildingNumber, primary.houseNumber)]
        .filter(Boolean)
        .join(" ") || undefined,
    postalCode: firstString(primary.postalCode, primary.zipCode),
    headquartersAddress: headquartersAddr ? formatAddressLine(headquartersAddr) : fallback ? formatAddressLine(fallback) : undefined,
    correspondenceAddress: correspondenceAddr ? formatAddressLine(correspondenceAddr) : undefined,
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

type BaeCategorySet = { label: string; values: string[] };
type BaePayloadVariant = { label: string; fields: Record<string, unknown> };

/**
 * SE API przyjmuje `searchCategory` jako tablicę enumów. Dla wyszukiwania po
 * NIP/REGON/KRS/nazwie najstabilniejszy wariant to łączony zestaw
 * COMPANY + ORGANISATION + PUBLIC_INSTITUTION (tak samo robią klienci WWW/BAE).
 */
function searchCategorySets(rt: BaeRecipientType): BaeCategorySet[] {
  const institutional = ["COMPANY", "ORGANISATION", "PUBLIC_INSTITUTION"];
  switch (rt) {
    case "ALL":
      return [
        { label: "COMPANY+ORGANISATION+PUBLIC_INSTITUTION", values: institutional },
        { label: "COMPANY+ORGANISATION", values: ["COMPANY", "ORGANISATION"] },
        { label: "PUBLIC_INSTITUTION", values: ["PUBLIC_INSTITUTION"] },
        { label: "COMPANY", values: ["COMPANY"] },
        { label: "ORGANISATION", values: ["ORGANISATION"] },
        { label: "COURT_ENFORCEMENT_OFFICER", values: ["COURT_ENFORCEMENT_OFFICER"] },
        { label: "INDIVIDUAL", values: ["INDIVIDUAL"] },
      ];
    case "PUBLIC":
      return [
        { label: "COMPANY+ORGANISATION+PUBLIC_INSTITUTION", values: institutional },
        { label: "PUBLIC_INSTITUTION", values: ["PUBLIC_INSTITUTION"] },
        { label: "ORGANISATION", values: ["ORGANISATION"] },
      ];
    case "NON_PUBLIC":
      return [
        { label: "COMPANY+ORGANISATION", values: ["COMPANY", "ORGANISATION"] },
        { label: "COMPANY", values: ["COMPANY"] },
        { label: "ORGANISATION", values: ["ORGANISATION"] },
        { label: "COMPANY+ORGANISATION+PUBLIC_INSTITUTION", values: institutional },
      ];
    case "KOMORNIK":
      return [{ label: "COURT_ENFORCEMENT_OFFICER", values: ["COURT_ENFORCEMENT_OFFICER"] }];
    case "OSOBA_FIZYCZNA":
      return [{ label: "INDIVIDUAL", values: ["INDIVIDUAL"] }];
  }
}

// In-memory cache: pierwszy zestaw searchCategory, który nie zwraca 00003.
const searchCategoryCache = new Map<BaeRecipientType, BaeCategorySet>();

function isEnumError(bodyStr: string): boolean {
  return (
    /"errorCode"\s*:\s*"?0*00003"?/i.test(bodyStr) ||
    /SEAPI-?00003/i.test(bodyStr) ||
    /Search Category provided is invalid/i.test(bodyStr) ||
    /Incorrect enum value/i.test(bodyStr) ||
    /not one of the values accepted for Enum/i.test(bodyStr)
  );
}

function isRetryableBaeShapeError(bodyStr: string): boolean {
  return (
    isEnumError(bodyStr) ||
    /SEAPI-?00008/i.test(bodyStr) ||
    /Unexpected search arguments/i.test(bodyStr) ||
    /not recognized or not expected/i.test(bodyStr) ||
    /No mandatory search arguments/i.test(bodyStr) ||
    /belong to different Search Sets/i.test(bodyStr) ||
    /Redundant field/i.test(bodyStr)
  );
}

/** SEAPI-00009: „invalid number of characters or illegal characters" — brak dopasowania,
 * a nie prawdziwy błąd systemowy. Prezentujemy jako pusty wynik. */
function isValidationEmptyResult(bodyStr: string): boolean {
  return (
    /SEAPI-?00009/i.test(bodyStr) ||
    /invalid number of characters/i.test(bodyStr) ||
    /illegal characters/i.test(bodyStr)
  );
}

function cleanOfficialId(idType: BaeIdentifierType, value: string): string {
  return idType === "NIP" || idType === "REGON" || idType === "KRS"
    ? value.replace(/\D/g, "")
    : value;
}

function officialIdPayloadVariants(idType: BaeIdentifierType, value: string): BaePayloadVariant[] {
  if (idType !== "NIP" && idType !== "REGON" && idType !== "KRS") return [{ label: "no-official-id", fields: {} }];
  const registry = idType.toLowerCase();
  const id = cleanOfficialId(idType, value);
  return [
    // Najczęściej spotykany kształt w kontraktach Java/OpenAPI: lista identyfikatorów z rejestrem.
    { label: `officialIds:${registry}/id`, fields: { officialIds: [{ referenceRegistry: registry, id }] } },
    { label: `officialIds:${registry}/value`, fields: { officialIds: [{ referenceRegistry: registry, value: id }] } },
    // Starsze klienty spotykane w integracjach mapują officialIds na obiekt z kluczami nip/regon/krs.
    { label: `officialIds.${registry}`, fields: { officialIds: { [registry]: id } } },
    { label: registry, fields: { [registry]: id } },
  ];
}

function addressPayloadVariants(address: BaeAddressInput, fallbackName: string): BaePayloadVariant[] {
  const countryCode = address.countryCode?.trim().toUpperCase() || "PL";
  const entityName = address.entityName?.trim() || fallbackName;
  const addr = {
    addressType: ["headquarters"],
    countryCode,
    country: countryCode,
    ...(address.city?.trim() ? { city: address.city.trim() } : {}),
    ...(address.postalCode?.trim() ? { postalCode: address.postalCode.trim() } : {}),
    ...(address.street?.trim() ? { street: address.street.trim() } : {}),
    ...(address.buildingNumber?.trim() ? { buildingNumber: address.buildingNumber.trim() } : {}),
    ...(address.flatNumber?.trim() ? { flatNumber: address.flatNumber.trim() } : {}),
  };
  return [
    { label: "entity+address[]", fields: { entityName, address: [addr] } },
    { label: "entity+address", fields: { entityName, address: addr } },
  ];
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

  const addr = input.address ?? {};
  const payloadVariants =
    input.identifierType === "NAME"
      ? addressPayloadVariants(addr, val)
      : officialIdPayloadVariants(input.identifierType, val);

  const buildEdaBody = (path: string): Record<string, unknown> =>
    path.endsWith("/bae_search")
      ? { senderEda, recipientEdasOnly: true, recipientEdas: [val.toUpperCase()], offset: 0, limit }
      : { senderEda, recipientEdas: [val.toUpperCase()], offset: 0, limit };

  const buildBaeBody = (
    categorySet: BaeCategorySet,
    variant: BaePayloadVariant,
    searchCategory: string | string[],
  ): Record<string, unknown> => ({
    senderEda,
    recipientEdasOnly: false,
    searchCategory,
    ...variant.fields,
    offset: 0,
    limit,
  });

  const categoryPayloads = (categorySet: BaeCategorySet): { label: string; value: string | string[] }[] =>
    categorySet.values.length === 1
      ? [
          { label: `${categorySet.label}[]`, value: categorySet.values },
          { label: `${categorySet.label}:string`, value: categorySet.values[0] },
        ]
      : [{ label: `${categorySet.label}[]`, value: categorySet.values }];

  const path = scenario === "eda" ? "/api/se/v3/search/eda_search" : "/api/se/v3/search/bae_search";
  const pathCandidates =
    scenario === "eda"
      ? [
          path,
          path.replace("/api/se/v3/", "/api/se/v4/"),
          "/api/se/v3/search/bae_search",
          "/api/se/v4/search/bae_search",
        ]
      : [path.replace("/api/se/v3/", "/api/se/v4/"), path];

  const cached = searchCategoryCache.get(input.recipientType);
  const categoryCandidates =
    scenario === "eda"
      ? []
      : cached
        ? [cached, ...searchCategorySets(input.recipientType).filter((c) => c.label !== cached.label)]
        : searchCategorySets(input.recipientType);

  const tried: string[] = [];
  let lastError: string | undefined;
  let emptySuccess: BaeSearchResponse | undefined;

  for (const p of pathCandidates) {
    let pathBroken = false;
    let sawOnlyRetryableErrors = false;
    let stopPath = false;
    if (scenario === "eda") {
      const label = `POST ${p}`;
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
          body: JSON.stringify(buildEdaBody(p)),
          timeoutMs: 20000,
        });
        const bodyStr = res.body ?? "";
        if ((res.status === 404 && !/SEAPI-00010/i.test(bodyStr)) || res.status === 405) {
          continue;
        }
        let json: unknown = null;
        try {
          json = bodyStr ? JSON.parse(bodyStr) : null;
        } catch {
          /* pusto */
        }
        if (res.status >= 200 && res.status < 300) {
          const arr = extractBaeItems(json);
          const items = arr.map(mapBaeItem).filter((r) => !!r.address);
          if (items.length) return { ok: true, results: items, triedPaths: tried };
          emptySuccess ??= { ok: true, results: [], triedPaths: tried };
          continue;
        }
        if (res.status === 404 && /SEAPI-00010/i.test(bodyStr)) {
          emptySuccess ??= { ok: true, results: [], triedPaths: tried };
          continue;
        }
        lastError = `HTTP ${res.status}: ${bodyStr.slice(0, 300)}`;
      } catch (err) {
        lastError = (err as Error).message;
      }
      continue;
    }

    for (const categorySet of categoryCandidates) {
      if (pathBroken || stopPath) break;
      for (const categoryPayload of categoryPayloads(categorySet)) {
        if (pathBroken || stopPath) break;
        for (const variant of payloadVariants) {
          if (pathBroken || stopPath) break;
          const label = `POST ${p} [${categoryPayload.label}; ${variant.label}]`;
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
              body: JSON.stringify(buildBaeBody(categorySet, variant, categoryPayload.value)),
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
              searchCategoryCache.set(input.recipientType, categorySet);
              const arr = extractBaeItems(json);
              const items = arr.map(mapBaeItem).filter((r) => !!r.address);
              if (items.length) return { ok: true, results: items, triedPaths: tried };
              emptySuccess ??= { ok: true, results: [], triedPaths: tried };
              continue;
            }
            if (res.status === 404 && /SEAPI-00010/i.test(bodyStr)) {
              emptySuccess ??= { ok: true, results: [], triedPaths: tried };
              continue;
            }
            // Walidacja długości/znaków (SEAPI-00009) — traktujemy jako brak wyników.
            if (isValidationEmptyResult(bodyStr)) {
              emptySuccess ??= { ok: true, results: [], triedPaths: tried };
              continue;
            }
            // Błąd enuma/kształtu → spróbuj kolejnego zestawu kategorii albo kształtu pól.
            if (isRetryableBaeShapeError(bodyStr)) {
              sawOnlyRetryableErrors = true;
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
    }
  }

  if (emptySuccess) return { ...emptySuccess, triedPaths: tried };

  return {
    ok: false,
    results: [],
    triedPaths: tried,
    error: lastError ?? "Endpoint SE API (BAE) nie odpowiada",
  };
}


