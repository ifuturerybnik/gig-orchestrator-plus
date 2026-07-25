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

export async function adeApiCall(opts: {
  method: string;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timeoutMs?: number;
}): Promise<{ status: number; body: string; json: unknown; headers: Record<string, string> }> {
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
  });
  let json: unknown = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    /* niepoprawny JSON — zostaw null */
  }
  return { status: res.status, body: res.body, json, headers: res.headers };
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

/** Best-effort mapowanie odpowiedzi UA API na strukturę używaną w UI. */
export function normalizeInboxItems(raw: unknown): AdeInboxItem[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { messages?: unknown[] })?.messages)
      ? ((raw as { messages: unknown[] }).messages)
      : Array.isArray((raw as { items?: unknown[] })?.items)
        ? ((raw as { items: unknown[] }).items)
        : Array.isArray((raw as { content?: unknown[] })?.content)
          ? ((raw as { content: unknown[] }).content)
          : [];
  return arr.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    // UA API v3 zwraca { messageMetadata: { messageId, timestamp, shippingService, ... } }
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
