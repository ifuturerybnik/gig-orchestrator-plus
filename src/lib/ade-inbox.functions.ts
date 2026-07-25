import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdeInboxRow = {
  id: string;                  // DB id (uuid)
  adeMessageId: string;
  from?: string;
  fromName?: string;
  to?: string;
  toName?: string;
  subject?: string;
  receivedAt?: string;
  status?: string;
  readAt?: string;
  hasBody: boolean;
  attachmentCount: number;
};

export type AdeInboxResult = {
  ok: boolean;
  items: AdeInboxRow[];
  mailbox: string;
  fetchedAt: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  error?: string;
};

export type AdeAttachmentRow = {
  id: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
};

export type AdeEvidence = {
  type?: string;
  eventDate?: string;
  reason?: string;
};

export type AdeDeliveryDetail = {
  ok: boolean;
  id: string;
  adeMessageId: string;
  subject?: string;
  from?: string;
  fromName?: string;
  to?: string;
  toName?: string;
  receivedAt?: string;
  bodyText?: string;
  rawJson?: string;
  attachments: AdeAttachmentRow[];
  evidences: AdeEvidence[];
  error?: string;
};

/** Zsynchronizuj skrzynkę ADE do bazy (upsert). */
export const syncAdeInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin, syncInboxToDb } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await syncInboxToDb({ limit: data.limit ?? 100 });
  });

/** Zwróć listę wiadomości z bazy (posortowaną po dacie). */
export const listStoredDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<AdeInboxResult> => {
    const { requireEdoreczeniaAdmin } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    const { loadAdeConfig } = await import("@/lib/ade-client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = loadAdeConfig();
    const limit = data.limit ?? 100;
    const { data: rows, error } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select("id, ade_message_id, from_address, to_address, subject, received_at, status, read_at, body_text, raw")
      .eq("mailbox_address", cfg.mailboxAddress)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return { ok: false, items: [], mailbox: cfg.mailboxAddress, fetchedAt: new Date().toISOString(), error: error.message };

    const ids = (rows ?? []).map((r) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: atts } = await supabaseAdmin
        .from("edoreczenia_attachments")
        .select("delivery_id")
        .in("delivery_id", ids);
      for (const a of atts ?? []) {
        counts[a.delivery_id] = (counts[a.delivery_id] ?? 0) + 1;
      }
    }
    const { data: sync } = await supabaseAdmin
      .from("edoreczenia_sync_state")
      .select("last_synced_at, last_error")
      .eq("mailbox_address", cfg.mailboxAddress)
      .maybeSingle();

    const partyName = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      const contrib = (one as { contributor?: Record<string, unknown> })?.contributor;
      const name = contrib?.companyName ?? contrib?.name;
      return typeof name === "string" ? name : undefined;
    };

    return {
      ok: true,
      mailbox: cfg.mailboxAddress,
      fetchedAt: new Date().toISOString(),
      lastSyncedAt: sync?.last_synced_at ?? undefined,
      lastSyncError: sync?.last_error ?? undefined,
      items: (rows ?? []).map((r) => {
        const meta = ((r.raw as { messageMetadata?: Record<string, unknown> } | null)?.messageMetadata ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          adeMessageId: r.ade_message_id ?? "",
          from: r.from_address ?? undefined,
          fromName: partyName(meta.from),
          to: r.to_address ?? undefined,
          toName: partyName(meta.to),
          subject: r.subject ?? undefined,
          receivedAt: r.received_at ?? undefined,
          status: r.status ?? undefined,
          readAt: r.read_at ?? undefined,
          hasBody: !!r.body_text,
          attachmentCount: counts[r.id] ?? 0,
        };
      }),
    };
  });

/** Otwórz wiadomość — jeśli treść jeszcze nie zapisana, pobierz z ADE i zapisz do Storage/DB. */
export const openStoredDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<AdeDeliveryDetail> => {
    const { requireEdoreczeniaAdmin, fetchAndStoreMessage, signedAttachmentUrl } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: delivery } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select("id, ade_message_id, subject, from_address, to_address, received_at, body_text, raw")
      .eq("id", data.id)
      .maybeSingle();
    if (!delivery) {
      return { ok: false, id: data.id, adeMessageId: "", attachments: [], evidences: [], error: "Nie znaleziono wiadomości" };
    }

    if (!delivery.body_text) {
      const r = await fetchAndStoreMessage(delivery.id);
      if (!r.ok) {
        return {
          ok: false,
          id: delivery.id,
          adeMessageId: delivery.ade_message_id ?? "",
          subject: delivery.subject ?? undefined,
          from: delivery.from_address ?? undefined,
          to: delivery.to_address ?? undefined,
          receivedAt: delivery.received_at ?? undefined,
          attachments: [],
          evidences: [],
          error: r.error,
        };
      }
    }

    const { data: refreshed } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select("id, ade_message_id, subject, from_address, to_address, received_at, body_text, raw")
      .eq("id", data.id)
      .maybeSingle();

    const { data: atts } = await supabaseAdmin
      .from("edoreczenia_attachments")
      .select("id, filename, mime_type, size_bytes, storage_path")
      .eq("delivery_id", data.id);

    const attachments: AdeAttachmentRow[] = [];
    for (const a of atts ?? []) {
      const url = a.storage_path ? (await signedAttachmentUrl(a.storage_path)) ?? undefined : undefined;
      attachments.push({
        id: a.id,
        filename: a.filename,
        mimeType: a.mime_type ?? undefined,
        sizeBytes: a.size_bytes ?? undefined,
        url,
      });
    }

    // Wyciągnij nazwy nadawcy/odbiorcy i evidences z raw payloadu
    const rawObj = (refreshed?.raw ?? {}) as Record<string, unknown>;
    const meta = (rawObj.messageMetadata ?? {}) as Record<string, unknown>;
    const partyName = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      const contrib = (one as { contributor?: Record<string, unknown> })?.contributor;
      const name = contrib?.companyName ?? contrib?.name;
      return typeof name === "string" ? name : undefined;
    };
    const fromName = partyName(meta.from);
    const toName = partyName(meta.to);
    const evidencesRaw = Array.isArray(rawObj.evidences) ? (rawObj.evidences as Array<Record<string, unknown>>) : [];
    const evidences: AdeEvidence[] = evidencesRaw.map((e) => ({
      type: typeof e.type === "string" ? e.type : undefined,
      eventDate: typeof e.eventDate === "string" ? e.eventDate : undefined,
      reason: Array.isArray(e.reasonDetails) && typeof e.reasonDetails[0] === "string"
        ? (e.reasonDetails[0] as string)
        : undefined,
    }));

    return {
      ok: true,
      id: refreshed?.id ?? delivery.id,
      adeMessageId: refreshed?.ade_message_id ?? "",
      subject: refreshed?.subject ?? undefined,
      from: refreshed?.from_address ?? undefined,
      fromName,
      to: refreshed?.to_address ?? undefined,
      toName,
      receivedAt: refreshed?.received_at ?? undefined,
      bodyText: refreshed?.body_text ?? undefined,
      rawJson: refreshed?.raw ? JSON.stringify(refreshed.raw) : undefined,
      attachments,
      evidences,
    };
  });
