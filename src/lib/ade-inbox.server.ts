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
}): Promise<{ status: number; body: string; bodyBuffer?: Buffer; json: unknown; headers: Record<string, string> }> {
  const token = await getAdeAccessToken();
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await adeRawRequest({
    method: opts.method,
    path: opts.path + qs,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": opts.body ? "application/json" : "application/json",
    },
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
  status?: string;
};

/** Zwraca listę wiadomości ze skrzynki (limit ustawia klient). */
export async function listAdeInboxRaw(params: { limit?: number; page?: number } = {}) {
  const cfg = loadAdeConfig();
  // UA API v3: GET /api/v3/{eDeliveryAddress}/messages
  const path = `/api/v3/${encodeURIComponent(cfg.mailboxAddress)}/messages`;
  const res = await adeApiCall({
    method: "GET",
    path,
    query: { limit: params.limit ?? 50, page: params.page ?? 0 },
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

/** Best-effort mapowanie odpowiedzi UA API na strukturę używaną w UI. */
export function normalizeInboxItems(raw: unknown): AdeInboxItem[] {
  return extractRawItems(raw).map((o) => {
    const meta = (o.messageMetadata ?? o.metadata ?? {}) as Record<string, unknown>;
    const pick = <T = unknown>(...keys: string[]): T | undefined => {
      for (const k of keys) {
        if (o[k] !== undefined) return o[k] as T;
        if (meta[k] !== undefined) return meta[k] as T;
      }
      return undefined;
    };
    const id = String(pick("messageId", "id", "uuid", "identifier") ?? "");
    return {
      id,
      from: pick<string>("from", "sender", "fromAddress", "senderAddress", "senderEDeliveryAddress"),
      to: pick<string>("to", "recipient", "toAddress", "recipientAddress", "recipientEDeliveryAddress"),
      subject: pick<string>("subject", "title"),
      receivedAt: pick<string>("timestamp", "receivedAt", "receivedDate", "createdAt", "date"),
      status: pick<string>("shippingService", "status", "state"),
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

/** Pobierz listę wiadomości z ADE i upsertuj do public.edoreczenia_deliveries. */
export async function syncInboxToDb(params: { limit?: number } = {}): Promise<SyncSummary> {
  const cfg = loadAdeConfig();
  const summary: SyncSummary = { ok: false, mailbox: cfg.mailboxAddress, fetched: 0, inserted: 0, updated: 0 };
  try {
    const res = await listAdeInboxRaw({ limit: params.limit ?? 100 });
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
      const row = {
        direction: "inbound" as const,
        ade_message_id: n.id,
        sender_address: n.from ?? null,
        recipient_address: n.to ?? cfg.mailboxAddress,
        from_address: n.from ?? null,
        to_address: n.to ?? cfg.mailboxAddress,
        subject: n.subject ?? null,
        received_at: n.receivedAt ?? null,
        status: n.status ?? "new",
        has_attachments: false,
        attachment_count: 0,
        fetched_at: new Date().toISOString(),
        ade_metadata: raw,
        raw,
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
        id: 1,
        last_sync_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
        messages_seen: summary.fetched,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    summary.ok = true;
    return summary;
  } catch (err) {
    summary.error = (err as Error).message;
    try {
      const admin = await getAdmin();
      await admin.from("edoreczenia_sync_state").upsert(
        {
          id: 1,
          last_sync_at: new Date().toISOString(),
          last_error: summary.error,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
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
    .select("id, ade_message_id")
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
    const bodyText = res.body;
    const payload = res.json;
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
          content_type: ref.mime ?? null,
          size_bytes: ref.size ?? attRes.bodyBuffer.length,
          storage_path: storagePath,
        };
        if (existingAtt?.id) await admin.from("edoreczenia_attachments").update(row).eq("id", existingAtt.id);
        else await admin.from("edoreczenia_attachments").insert(row);

        stored.push({
          id: ref.id,
          filename: ref.filename,
          mime_type: row.content_type ?? undefined,
          size_bytes: row.size_bytes,
          storage_path: storagePath,
        });
      } catch {
        /* pomiń pojedynczy załącznik */
      }
    }

    await admin
      .from("edoreczenia_deliveries")
      .update({
        body_text: bodyText,
        raw: (payload ?? null) as unknown,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    return { ok: true, bodyText, attachments: stored };
  } catch (err) {
    return { ok: false, attachments: [], error: (err as Error).message };
  }
}

/** Wygeneruj signed URL dla załącznika (godzina). */
export async function signedAttachmentUrl(storagePath: string): Promise<string | null> {
  const admin = await getAdmin();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}
