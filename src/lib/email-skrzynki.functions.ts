// Server functions dla zarządzania skrzynkami pocztowymi (tabela email_skrzynki).
// CRUD przez supabaseAdmin (bo INSERT/UPDATE/DELETE są zablokowane RLS — szyfrowanie
// haseł musi iść przez serwer).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptMailPassword } from "./mail-crypto.server";
import { callMailProxy } from "./mail-proxy.server";

const SAFE_COLUMNS: string =
  "id, nazwa, nazwa_wyswietlana, ikona_url, typ, owner_user_id, organization_id, email, imap_host, imap_port, imap_login, imap_use_ssl, smtp_host, smtp_port, smtp_login, smtp_use_ssl, aktywna, last_sync_at, last_sync_error, created_at, updated_at" as const;
const SAFE_COLUMNS_BASE: string =
  "id, nazwa, nazwa_wyswietlana, typ, owner_user_id, organization_id, email, imap_host, imap_port, imap_login, imap_use_ssl, smtp_host, smtp_port, smtp_login, smtp_use_ssl, aktywna, last_sync_at, last_sync_error, created_at, updated_at" as const;
let supportsIkonaUrlColumn: boolean | null = null;

type SkrzynkaSafeRow = {
  id: string;
  nazwa: string;
  nazwa_wyswietlana: string | null;
  ikona_url: string | null;
  typ: "osobista" | "wspolna";
  owner_user_id: string | null;
  organization_id: string | null;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_login: string;
  imap_use_ssl: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_login: string;
  smtp_use_ssl: boolean;
  aktywna: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

const TypEnum = z.enum(["osobista", "wspolna"]);

const portSchema = z.number().int().min(1).max(65535);
const hostSchema = z.string().trim().min(1).max(255);
const loginSchema = z.string().trim().min(1).max(255);
const emailSchema = z.string().trim().toLowerCase().email().max(255);
// data URL (base64) lub https URL — cap ~200KB.
const ikonaSchema = z.string().trim().max(200_000).nullable().optional();

const skrzynkaInputSchema = z.object({
  nazwa: z.string().trim().min(1).max(120),
  nazwa_wyswietlana: z.string().trim().max(160).nullable().optional(),
  ikona_url: ikonaSchema,
  typ: TypEnum,
  organizationId: z.string().uuid().nullable().optional(),
  email: emailSchema,
  imap_host: hostSchema,
  imap_port: portSchema,
  imap_login: loginSchema,
  imap_haslo: z.string().min(1).max(500),
  imap_use_ssl: z.boolean(),
  smtp_host: hostSchema,
  smtp_port: portSchema,
  smtp_login: loginSchema,
  smtp_haslo: z.string().min(1).max(500),
  smtp_use_ssl: z.boolean(),
});

// Update — bez typ/organizationId (nie pozwalamy migrować skrzynki między ownerami).
// Hasła opcjonalne: jeśli puste/undefined ⇒ zachowaj bieżące.
const skrzynkaUpdateSchema = z.object({
  skrzynkaId: z.string().uuid(),
  nazwa: z.string().trim().min(1).max(120),
  nazwa_wyswietlana: z.string().trim().max(160).nullable().optional(),
  ikona_url: ikonaSchema,
  email: emailSchema,
  imap_host: hostSchema,
  imap_port: portSchema,
  imap_login: loginSchema,
  imap_haslo: z.string().max(500).optional().nullable(),
  imap_use_ssl: z.boolean(),
  smtp_host: hostSchema,
  smtp_port: portSchema,
  smtp_login: loginSchema,
  smtp_haslo: z.string().max(500).optional().nullable(),
  smtp_use_ssl: z.boolean(),
});

function isMissingIkonaColumnError(error: { message?: string; code?: string } | null): boolean {
  return !!error && /ikona_url/i.test(error.message ?? "");
}

function withMissingIkonaFallback<T extends Record<string, unknown>>(rows: T[] | null | undefined) {
  return (rows ?? []).map((row) => ({ ikona_url: null, ...row })) as unknown as SkrzynkaSafeRow[];
}

function columnsForSelect(): string {
  return supportsIkonaUrlColumn === false ? SAFE_COLUMNS_BASE : SAFE_COLUMNS;
}

function omitIkonaIfUnsupported<T extends Record<string, unknown>>(row: T): T {
  if (supportsIkonaUrlColumn !== false) return row;
  const { ikona_url: _ikonaUrl, ...withoutIkona } = row;
  return withoutIkona as T;
}


async function userIsMember(userId: string, organizationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function userIsOwner(userId: string, organizationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  return !!data;
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
export const listSkrzynki = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scope: z.enum(["mine", "organization"]),
        organizationId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    if (data.scope === "organization") {
      if (!data.organizationId) throw new Error("organizationId is required");
      if (!(await userIsMember(userId, data.organizationId))) {
        throw new Error("Forbidden");
      }
      let { data: rows, error } = await supabaseAdmin
        .from("email_skrzynki")
        .select(columnsForSelect())
        .eq("organization_id", data.organizationId)
        .eq("typ", "wspolna")
        .order("created_at", { ascending: false });
      if (isMissingIkonaColumnError(error)) {
        supportsIkonaUrlColumn = false;
        const fallback = await supabaseAdmin
          .from("email_skrzynki")
          .select(SAFE_COLUMNS_BASE)
          .eq("organization_id", data.organizationId)
          .eq("typ", "wspolna")
          .order("created_at", { ascending: false });
        rows = fallback.data;
        error = fallback.error;
      }
      if (error) throw new Error(error.message);
      return { skrzynki: withMissingIkonaFallback(rows as unknown as Record<string, unknown>[]) };
    }

    let { data: rows, error } = await supabaseAdmin
      .from("email_skrzynki")
      .select(columnsForSelect())
      .eq("owner_user_id", userId)
      .eq("typ", "osobista")
      .order("created_at", { ascending: false });
    if (isMissingIkonaColumnError(error)) {
      supportsIkonaUrlColumn = false;
      const fallback = await supabaseAdmin
        .from("email_skrzynki")
        .select(SAFE_COLUMNS_BASE)
        .eq("owner_user_id", userId)
        .eq("typ", "osobista")
        .order("created_at", { ascending: false });
      rows = fallback.data;
      error = fallback.error;
    }
    if (error) throw new Error(error.message);
    return { skrzynki: withMissingIkonaFallback(rows as unknown as Record<string, unknown>[]) };
  });

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export const createSkrzynka = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => skrzynkaInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    if (data.typ === "wspolna") {
      if (!data.organizationId) throw new Error("organizationId is required for wspolna");
      if (!(await userIsOwner(userId, data.organizationId))) {
        throw new Error("Only organization owner can add shared mailboxes");
      }
    } else if (data.organizationId) {
      throw new Error("Personal mailbox cannot have organizationId");
    }

    const row = {
      nazwa: data.nazwa,
      nazwa_wyswietlana: data.nazwa_wyswietlana?.trim() || null,
      ikona_url: data.ikona_url?.trim() || null,
      typ: data.typ,
      owner_user_id: data.typ === "osobista" ? userId : null,
      organization_id: data.typ === "wspolna" ? data.organizationId : null,
      email: data.email,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_login: data.imap_login,
      imap_haslo_encrypted: encryptMailPassword(data.imap_haslo),
      imap_use_ssl: data.imap_use_ssl,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_login: data.smtp_login,
      smtp_haslo_encrypted: encryptMailPassword(data.smtp_haslo),
      smtp_use_ssl: data.smtp_use_ssl,
    };


    let { data: created, error } = await supabaseAdmin
      .from("email_skrzynki")
      .insert(omitIkonaIfUnsupported(row))
      .select(columnsForSelect())
      .single();
    if (isMissingIkonaColumnError(error)) {
      supportsIkonaUrlColumn = false;
      const fallback = await supabaseAdmin
        .from("email_skrzynki")
        .insert(omitIkonaIfUnsupported(row))
        .select(SAFE_COLUMNS_BASE)
        .single();
      created = fallback.data;
      error = fallback.error;
    }
    if (error) throw new Error(error.message);
    return { skrzynka: withMissingIkonaFallback([created as unknown as Record<string, unknown>])[0] };
  });

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
export const updateSkrzynka = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => skrzynkaUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id, typ, owner_user_id, organization_id")
      .eq("id", data.skrzynkaId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Not found");

    if (existing.typ === "osobista" && existing.owner_user_id !== userId) {
      throw new Error("Forbidden");
    }
    if (
      existing.typ === "wspolna" &&
      !(await userIsOwner(userId, existing.organization_id as string))
    ) {
      throw new Error("Forbidden");
    }

    const patch: Record<string, unknown> = {
      nazwa: data.nazwa,
      nazwa_wyswietlana: data.nazwa_wyswietlana?.trim() || null,
      ikona_url: data.ikona_url?.trim() || null,
      email: data.email,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_login: data.imap_login,
      imap_use_ssl: data.imap_use_ssl,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_login: data.smtp_login,
      smtp_use_ssl: data.smtp_use_ssl,
      updated_at: new Date().toISOString(),
    };
    if (data.imap_haslo && data.imap_haslo.length > 0) {
      patch.imap_haslo_encrypted = encryptMailPassword(data.imap_haslo);
    }
    if (data.smtp_haslo && data.smtp_haslo.length > 0) {
      patch.smtp_haslo_encrypted = encryptMailPassword(data.smtp_haslo);
    }

    let { data: updated, error } = await supabaseAdmin
      .from("email_skrzynki")
      .update(omitIkonaIfUnsupported(patch))
      .eq("id", data.skrzynkaId)
      .select(columnsForSelect())
      .single();
    if (isMissingIkonaColumnError(error)) {
      supportsIkonaUrlColumn = false;
      const fallback = await supabaseAdmin
        .from("email_skrzynki")
        .update(omitIkonaIfUnsupported(patch))
        .eq("id", data.skrzynkaId)
        .select(SAFE_COLUMNS_BASE)
        .single();
      updated = fallback.data;
      error = fallback.error;
    }
    if (error) throw new Error(error.message);
    return { skrzynka: withMissingIkonaFallback([updated as unknown as Record<string, unknown>])[0] };
  });


// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export const deleteSkrzynka = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ skrzynkaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id, typ, owner_user_id, organization_id")
      .eq("id", data.skrzynkaId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Not found");

    if (existing.typ === "osobista" && existing.owner_user_id !== userId) {
      throw new Error("Forbidden");
    }
    if (
      existing.typ === "wspolna" &&
      !(await userIsOwner(userId, existing.organization_id as string))
    ) {
      throw new Error("Forbidden");
    }

    const { error } = await supabaseAdmin
      .from("email_skrzynki")
      .delete()
      .eq("id", data.skrzynkaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// SYNC trigger (proxy)
// ---------------------------------------------------------------------------
export const syncSkrzynka = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        skrzynkaId: z.string().uuid(),
        folder: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("email_skrzynki")
      .select("id, typ, owner_user_id, organization_id")
      .eq("id", data.skrzynkaId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Not found");

    if (existing.typ === "osobista" && existing.owner_user_id !== userId) {
      throw new Error("Forbidden");
    }
    if (
      existing.typ === "wspolna" &&
      !(await userIsMember(userId, existing.organization_id as string))
    ) {
      throw new Error("Forbidden");
    }

    await callMailProxy("sync", {
      skrzynka_id: data.skrzynkaId,
      folder: data.folder ?? null,
    });
    return { ok: true };
  });
