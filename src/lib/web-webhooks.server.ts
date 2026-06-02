// Webhook dispatcher dla modułów WWW.
// HMAC-SHA256 sign w nagłówku X-Concertivo-Signature.
// Fire-and-forget z timeoutem; każda próba logowana do web_webhook_deliveries.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WebhookEvent =
  | "news.published"
  | "news.updated"
  | "news.deleted"
  | "event.published"
  | "event.updated"
  | "event.deleted"
  | "album.published"
  | "album.updated"
  | "album.deleted";

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deliverOne(
  hook: { id: string; organization_id: string; target_url: string; secret: string },
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify({ event, occurred_at: new Date().toISOString(), data: payload });
  const sig = await hmacHex(hook.secret, body);
  const started = Date.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10_000);
  let status: number | null = null;
  let ok = false;
  let err: string | null = null;
  try {
    const res = await fetch(hook.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Concertivo-Event": event,
        "X-Concertivo-Signature": `sha256=${sig}`,
        "User-Agent": "Concertivo-Webhook/1.0",
      },
      body,
      signal: ctrl.signal,
    });
    status = res.status;
    ok = res.ok;
    if (!ok) err = `HTTP ${res.status}`;
  } catch (e) {
    err = (e as Error)?.message?.slice(0, 500) ?? "fetch_failed";
  } finally {
    clearTimeout(to);
  }
  await supabaseAdmin.from("web_webhook_deliveries").insert({
    webhook_id: hook.id,
    organization_id: hook.organization_id,
    event,
    payload,
    status_code: status,
    ok,
    error: err,
    duration_ms: Date.now() - started,
  });
}

export async function notifyWebhooks(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("web_webhooks")
      .select("id, organization_id, target_url, secret, events, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const hooks = (data ?? []).filter((h) =>
      Array.isArray(h.events) ? (h.events as string[]).includes(event) : false,
    );
    if (hooks.length === 0) return;
    await Promise.allSettled(
      hooks.map((h) =>
        deliverOne(
          {
            id: h.id as string,
            organization_id: h.organization_id as string,
            target_url: h.target_url as string,
            secret: h.secret as string,
          },
          event,
          payload,
        ),
      ),
    );
  } catch {
    // best-effort
  }
}
