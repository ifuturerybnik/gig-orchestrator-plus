import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdeFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH";

export type AdeInboxRow = {
  id: string;
  adeMessageId: string;
  from?: string;
  fromName?: string;
  to?: string;
  toName?: string;
  subject?: string;
  receivedAt?: string;
  creationDate?: string;
  sentAt?: string;
  status?: string;
  readAt?: string;
  folder: AdeFolder;
  hasBody: boolean;
  attachmentCount: number;
};

export type AdeInboxResult = {
  ok: boolean;
  items: AdeInboxRow[];
  mailbox: string;
  fetchedAt: string;
  folder: AdeFolder;
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
  creationDate?: string;
  sentAt?: string;
  bodyText?: string;
  rawJson?: string;
  attachments: AdeAttachmentRow[];
  evidences: AdeEvidence[];
  evidenceZipUrl?: string;
  error?: string;
};

/** Zsynchronizuj skrzynkę ADE (per folder) do bazy. */
export const syncAdeInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; folder?: AdeFolder } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin, syncInboxToDb } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await syncInboxToDb({ limit: data.limit ?? 100, folder: data.folder ?? "INBOX" });
  });

/** Zwróć listę wiadomości z bazy (per folder). */
export const listStoredDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; folder?: AdeFolder } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<AdeInboxResult> => {
    const { requireEdoreczeniaAdmin } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    const { loadAdeConfig } = await import("@/lib/ade-client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = loadAdeConfig();
    const folder: AdeFolder = data.folder ?? "INBOX";
    const limit = data.limit ?? 100;
    const { data: rows, error } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select(
        "id, ade_message_id, from_address, to_address, subject, received_at, creation_date, sent_at, status, read_at, folder, body_text, raw",
      )
      .eq("mailbox_address", cfg.mailboxAddress)
      .eq("folder", folder)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error)
      return {
        ok: false,
        items: [],
        mailbox: cfg.mailboxAddress,
        fetchedAt: new Date().toISOString(),
        folder,
        error: error.message,
      };

    const ids = (rows ?? []).map((r) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: atts } = await supabaseAdmin
        .from("edoreczenia_attachments")
        .select("delivery_id")
        .in("delivery_id", ids);
      for (const a of atts ?? []) counts[a.delivery_id] = (counts[a.delivery_id] ?? 0) + 1;
    }
    const { data: sync } = await supabaseAdmin
      .from("edoreczenia_sync_state")
      .select("last_synced_at, last_error")
      .eq("mailbox_address", cfg.mailboxAddress)
      .maybeSingle();

    const unwrapRaw = (raw: unknown): Record<string, unknown> =>
      (Array.isArray(raw) ? (raw[0] ?? {}) : (raw ?? {})) as Record<string, unknown>;

    const partyName = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      if (!one || typeof one !== "object") return undefined;
      const contrib = (one as { contributor?: Record<string, unknown> })?.contributor;
      const name = contrib?.companyName ?? contrib?.name;
      return typeof name === "string" ? name : undefined;
    };
    const partyAddress = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      if (!one || typeof one !== "object") return undefined;
      const o = one as Record<string, unknown>;
      const a = o.eDeliveryAddress ?? o.edeliveryAddress ?? o.address;
      return typeof a === "string" ? a : undefined;
    };

    return {
      ok: true,
      mailbox: cfg.mailboxAddress,
      fetchedAt: new Date().toISOString(),
      folder,
      lastSyncedAt: sync?.last_synced_at ?? undefined,
      lastSyncError: sync?.last_error ?? undefined,
      items: (rows ?? []).map((r) => {
        const rawObj = unwrapRaw(r.raw);
        const meta = (rawObj.messageMetadata ?? {}) as Record<string, unknown>;
        const subject =
          (r.subject as string | undefined) ??
          (meta.subject as string | undefined) ??
          (rawObj.subject as string | undefined);
        return {
          id: r.id,
          adeMessageId: r.ade_message_id ?? "",
          from: r.from_address ?? partyAddress(meta.from),
          fromName: partyName(meta.from),
          to: r.to_address ?? partyAddress(meta.to),
          toName: partyName(meta.to),
          subject,
          receivedAt: r.received_at ?? undefined,
          creationDate: r.creation_date ?? (meta.creationDate as string | undefined),
          sentAt: r.sent_at ?? (meta.submissionDate as string | undefined),
          status: r.status ?? undefined,
          readAt: r.read_at ?? undefined,
          folder: (r.folder as AdeFolder | null) ?? folder,
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
    const { requireEdoreczeniaAdmin, fetchAndStoreMessage, signedAttachmentUrl } = await import(
      "@/lib/ade-inbox.server"
    );
    await requireEdoreczeniaAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const SELECT =
      "id, ade_message_id, subject, from_address, to_address, received_at, creation_date, sent_at, body_text, raw, evidence_storage_path";

    const { data: delivery } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (!delivery) {
      return {
        ok: false,
        id: data.id,
        adeMessageId: "",
        attachments: [],
        evidences: [],
        error: "Nie znaleziono wiadomości",
      };
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
          creationDate: delivery.creation_date ?? undefined,
          sentAt: delivery.sent_at ?? undefined,
          attachments: [],
          evidences: [],
          error: r.error,
        };
      }
    }

    const { data: refreshed } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select(SELECT)
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

    const rawUnwrapped = Array.isArray(refreshed?.raw)
      ? ((refreshed!.raw as unknown[])[0] ?? {})
      : (refreshed?.raw ?? {});
    const rawObj = rawUnwrapped as Record<string, unknown>;
    const meta = (rawObj.messageMetadata ?? {}) as Record<string, unknown>;
    const partyName = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      if (!one || typeof one !== "object") return undefined;
      const contrib = (one as { contributor?: Record<string, unknown> })?.contributor;
      const name = contrib?.companyName ?? contrib?.name;
      return typeof name === "string" ? name : undefined;
    };
    const partyAddress = (node: unknown): string | undefined => {
      if (!node) return undefined;
      const one = Array.isArray(node) ? node[0] : node;
      if (!one || typeof one !== "object") return undefined;
      const o = one as Record<string, unknown>;
      const a = o.eDeliveryAddress ?? o.edeliveryAddress ?? o.address;
      return typeof a === "string" ? a : undefined;
    };
    const fromName = partyName(meta.from);
    const toName = partyName(meta.to);
    const subject =
      (refreshed?.subject as string | undefined) ??
      (meta.subject as string | undefined) ??
      (rawObj.subject as string | undefined);
    const rawTextBody =
      (typeof rawObj.textBody === "string" ? (rawObj.textBody as string) : undefined) ??
      (typeof rawObj.bodyText === "string" ? (rawObj.bodyText as string) : undefined);
    const storedBody = refreshed?.body_text as string | undefined;
    const looksLikeJson = !!storedBody && /^\s*[\[{]/.test(storedBody);
    const bodyTextFallback = rawTextBody ?? (looksLikeJson ? undefined : storedBody);
    const evidencesRaw = Array.isArray(rawObj.evidences)
      ? (rawObj.evidences as Array<Record<string, unknown>>)
      : [];
    const evidences: AdeEvidence[] = evidencesRaw.map((e) => ({
      type: typeof e.type === "string" ? e.type : undefined,
      eventDate: typeof e.eventDate === "string" ? e.eventDate : undefined,
      reason:
        Array.isArray(e.reasonDetails) && typeof e.reasonDetails[0] === "string"
          ? (e.reasonDetails[0] as string)
          : undefined,
    }));

    // Najwcześniejsza `createDate` z evidences = data utworzenia wiadomości (D.1).
    const evidenceCreateDates = evidencesRaw
      .map((e) => (typeof e.createDate === "string" ? (e.createDate as string) : undefined))
      .filter((v): v is string => !!v)
      .sort();
    const evidenceEventDates = evidencesRaw
      .map((e) => (typeof e.eventDate === "string" ? (e.eventDate as string) : undefined))
      .filter((v): v is string => !!v)
      .sort();

    let evidenceZipUrl: string | undefined;
    if (refreshed?.evidence_storage_path) {
      const dlName = `dowody-${refreshed.ade_message_id ?? "edoreczenia"}.zip`;
      evidenceZipUrl =
        (await signedAttachmentUrl(refreshed.evidence_storage_path, dlName)) ?? undefined;
    }

    const creationDate =
      (refreshed?.creation_date as string | undefined) ??
      (meta.creationDate as string | undefined) ??
      (meta.createDate as string | undefined) ??
      evidenceCreateDates[0] ??
      evidenceEventDates[0];
    const sentAt =
      (refreshed?.sent_at as string | undefined) ??
      (meta.submissionDate as string | undefined) ??
      (meta.sendDate as string | undefined);


    return {
      ok: true,
      id: refreshed?.id ?? delivery.id,
      adeMessageId: refreshed?.ade_message_id ?? "",
      subject,
      from: refreshed?.from_address ?? partyAddress(meta.from),
      fromName,
      to: refreshed?.to_address ?? partyAddress(meta.to),
      toName,
      receivedAt: refreshed?.received_at ?? undefined,
      creationDate,
      sentAt,
      bodyText: bodyTextFallback,
      rawJson: refreshed?.raw ? JSON.stringify(refreshed.raw) : undefined,
      attachments,
      evidences,
      evidenceZipUrl,
    };
  });

/** Pobierz i zapisz ZIP z dowodami technicznymi; zwróć signed URL do pobrania. */
export const downloadEvidenceZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: boolean; url?: string; error?: string }> => {
    const { requireEdoreczeniaAdmin, fetchAndStoreEvidenceZip, signedAttachmentUrl } = await import(
      "@/lib/ade-inbox.server"
    );
    await requireEdoreczeniaAdmin(context);
    const res = await fetchAndStoreEvidenceZip(data.id);
    if (!res.ok) return { ok: false, error: res.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .select("ade_message_id")
      .eq("id", data.id)
      .maybeSingle();
    const dlName = `dowody-${d?.ade_message_id ?? "edoreczenia"}.zip`;
    const url = (await signedAttachmentUrl(res.storagePath, dlName)) ?? undefined;
    return { ok: true, url };
  });

/** Zbuduj i pobierz pełne archiwum wiadomości (ZIP w formacie zbliżonym do biznes.gov). */
export const downloadMessageArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; url?: string; filename?: string; error?: string }> => {
      const { requireEdoreczeniaAdmin, fetchAndBuildMessageArchive, signedAttachmentUrl } = await import(
        "@/lib/ade-inbox.server"
      );
      await requireEdoreczeniaAdmin(context);
      const res = await fetchAndBuildMessageArchive(data.id);
      if (!res.ok) return { ok: false, error: res.error };
      const url = (await signedAttachmentUrl(res.storagePath, res.filename)) ?? undefined;
      return { ok: true, url, filename: res.filename };
    },
  );

export type SendAdeMessagePayload = {
  recipients: string[];
  subject: string;
  bodyText: string;
  caseNumber?: string;
  attachments?: Array<{ filename: string; mimeType?: string; contentBase64: string }>;
};

/** Wyślij nową wiadomość e-Doręczenia. */
export const sendAdeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendAdeMessagePayload) => {
    if (!data || typeof data !== "object") throw new Error("Brak danych");
    if (!Array.isArray(data.recipients) || data.recipients.length === 0)
      throw new Error("Wymagany co najmniej jeden adresat");
    if (!data.subject || !data.subject.trim()) throw new Error("Temat jest wymagany");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin, sendAdeMessage: send } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await send(data);
  });

/** Przenieś wiadomość między folderami (lokalnie w bazie; UI aktualizuje się natychmiast). */
export const moveAdeDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; folder: AdeFolder }) => {
    if (!data?.id) throw new Error("Brak id");
    if (!data?.folder) throw new Error("Brak folderu docelowego");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("edoreczenia_deliveries")
      .update({ folder: data.folder })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export type SaveAdeDraftPayload = SendAdeMessagePayload & { draftId?: string };

/** Zapisz wiadomość jako roboczą (w biznes.gov i lokalnie). */
export const saveAdeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveAdeDraftPayload) => {
    if (!data || typeof data !== "object") throw new Error("Brak danych");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin, saveAdeDraft: save } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await save(data);
  });

/** Usuń wiadomość — najpierw w biznes.gov (ADE UA API), potem lokalnie.
 *  Domyślnie: soft-delete (przenieś do kosza). Z TRASH lub `hardDelete:true` — trwałe.
 */
export const deleteAdeDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; hardDelete?: boolean }) => {
    if (!data?.id) throw new Error("Brak id");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { requireEdoreczeniaAdmin, deleteAdeDelivery: del } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await del(data.id, { hardDelete: data.hardDelete });
  });


export type BaeRecipientType = "ALL" | "PUBLIC" | "NON_PUBLIC" | "KOMORNIK" | "OSOBA_FIZYCZNA";
export type BaeIdentifierType = "EDELIVERY_ADDRESS" | "NIP" | "REGON" | "KRS" | "NAME";

export type BaeAddressFields = {
  entityName?: string;
  countryCode?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  buildingNumber?: string;
  flatNumber?: string;
};

export type BaeSearchInput = {
  recipientType: BaeRecipientType;
  identifierType: BaeIdentifierType;
  value: string;
  limit?: number;
  address?: BaeAddressFields;
};

export type BaeSearchResultRow = {
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

export type BaeSearchResponsePayload = {
  ok: boolean;
  results: BaeSearchResultRow[];
  triedPaths: string[];
  error?: string;
};

/** Wyszukaj adresata w Bazie Adresów Elektronicznych (BAE) — bez cache, zawsze on-line. */
export const searchBaeAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BaeSearchInput) => {
    if (!data?.recipientType) throw new Error("Wybierz typ odbiorcy");
    if (!data?.identifierType) throw new Error("Wybierz typ identyfikatora");
    if (data.identifierType === "NAME") {
      const a = data.address ?? {};
      const name = (a.entityName ?? data.value ?? "").trim();
      const city = (a.city ?? "").trim();
      const building = (a.buildingNumber ?? "").trim();
      if (!name) throw new Error("Podaj nazwę instytucji");
      if (!city) throw new Error("Podaj miejscowość");
      if (!building) throw new Error("Podaj numer budynku");
    } else {
      if (!data?.value || !data.value.trim()) throw new Error("Podaj wartość do wyszukania");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<BaeSearchResponsePayload> => {
    const { requireEdoreczeniaAdmin, searchBae } = await import("@/lib/ade-inbox.server");
    await requireEdoreczeniaAdmin(context);
    return await searchBae(data);
  });





