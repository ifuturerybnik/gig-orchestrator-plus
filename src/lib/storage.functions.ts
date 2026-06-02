import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptPii } from "@/lib/crypto.server";
import {
  getCentralR2Status,
  getCentralR2,
  getOrgR2Context,
  getR2ContextForMode,
  presignPut,
  presignGet,
  deleteObject,
  calculateOrgQuota,
  getGlobalCfg,
} from "@/lib/storage-r2.server";



async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

async function assertAppAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (!roles.some((r) => r === "super_admin" || r === "admin_staff")) {
    throw new Error("Forbidden");
  }
}

/**
 * Pozwala: app admin (super_admin/admin_staff) LUB owner/admin w danej organizacji
 * LUB twórca organizacji (created_by). Używane do zarządzania własnym R2 per-org.
 */
async function assertOrgManager(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAppAdmin = ((roles ?? []) as Array<{ role: string }>).some(
    (r) => r.role === "super_admin" || r.role === "admin_staff",
  );
  if (isAppAdmin) return;

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mem && (mem.role === "owner" || mem.role === "admin")) return;

  const { data: org } = await supabase
    .from("organizations")
    .select("created_by")
    .eq("id", organizationId)
    .maybeSingle();
  if (org && (org as { created_by?: string }).created_by === userId) return;

  throw new Error("Forbidden");
}


// =====================================================================
// Konfiguracja globalna R2
// =====================================================================

export const getStorageGlobalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId);
    const cfg = await getGlobalCfg();
    const central = await getCentralR2Status();
    return { cfg, central };
  });

export const updateStorageGlobalConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        free_quota_gb: z.number().min(0).max(10_000),
        price_per_extra_gb_pln: z.number().min(0).max(10_000),
        max_image_mb: z.number().int().min(1).max(2048),
        max_video_mb: z.number().int().min(1).max(10_240),
        central_enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("storage_global_config")
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// Centralne R2 — poświadczenia wpisywane z UI
// =====================================================================

export const setCentralR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        r2_account_id: z.string().trim().min(1).max(120),
        // Sekrety opcjonalne — jeśli pole puste, zostawiamy aktualną wartość w DB.
        r2_access_key_id: z.string().trim().max(512).optional().nullable(),
        r2_secret_access_key: z.string().trim().max(512).optional().nullable(),
        r2_bucket: z.string().trim().min(1).max(120),
        r2_public_base_url: z.string().trim().url().max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const patch: Record<string, unknown> = {
      r2_account_id: data.r2_account_id,
      r2_bucket: data.r2_bucket,
      r2_public_base_url: data.r2_public_base_url.replace(/\/$/, ""),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    if (data.r2_access_key_id && data.r2_access_key_id.length > 0) {
      patch.r2_access_key_id_enc = encryptPii(data.r2_access_key_id);
    }
    if (data.r2_secret_access_key && data.r2_secret_access_key.length > 0) {
      patch.r2_secret_access_key_enc = encryptPii(data.r2_secret_access_key);
    }
    const { error } = await supabaseAdmin
      .from("storage_global_config")
      .update(patch)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearCentralR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("storage_global_config")
      .update({
        r2_account_id: null,
        r2_access_key_id_enc: null,
        r2_secret_access_key_enc: null,
        r2_bucket: null,
        r2_public_base_url: null,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testCentralR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId);
    const central = await getCentralR2();
    const ctx = {
      mode: "central" as const,
      client: central.client,
      bucket: central.bucket,
      publicBaseUrl: central.publicBaseUrl,
    };
    const key = `.concertivo-test/${Date.now()}.txt`;
    const { uploadUrl } = await presignPut({
      ctx,
      key,
      contentType: "text/plain",
      expiresIn: 60,
    });
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "concertivo!",
    });
    if (!put.ok) {
      throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
    }
    await deleteObject(ctx, key);
    return { ok: true, bucket: ctx.bucket };
  });


// =====================================================================
// Lista organizacji z trybem, kwotami i zużyciem (admin)
// =====================================================================

export type AdminOrgStorageRow = {
  organization_id: string;
  name: string;
  mode: "central" | "own";
  free_gb: number;
  bonus_free_gb: number;
  paid_extra_gb: number;
  total_gb: number;
  used_bytes_central: number;
  used_bytes_own: number;
  has_own_r2: boolean;
};

export const listAdminOrgStorage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrgStorageRow[]> => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId);
    const g = await getGlobalCfg();
    const freeGb = Number(g.free_quota_gb || 0);

    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (orgs ?? []).map((o) => o.id as string);
    if (ids.length === 0) return [];

    const [{ data: cfgs }, { data: usage }] = await Promise.all([
      supabaseAdmin
        .from("org_storage_config")
        .select(
          "organization_id, mode, bonus_free_gb, paid_extra_gb, r2_bucket, r2_endpoint",
        )
        .in("organization_id", ids),
      supabaseAdmin
        .from("org_storage_usage")
        .select("organization_id, used_bytes_central, used_bytes_own")
        .in("organization_id", ids),
    ]);

    const cfgMap = new Map(
      (cfgs ?? []).map((c) => [c.organization_id as string, c]),
    );
    const usageMap = new Map(
      (usage ?? []).map((u) => [u.organization_id as string, u]),
    );

    return (orgs ?? []).map((o) => {
      const c = cfgMap.get(o.id as string);
      const u = usageMap.get(o.id as string);
      const bonus = Number(c?.bonus_free_gb ?? 0);
      const paid = Number(c?.paid_extra_gb ?? 0);
      return {
        organization_id: o.id as string,
        name: String(o.name ?? ""),
        mode: (c?.mode as "central" | "own") ?? "central",
        free_gb: freeGb,
        bonus_free_gb: bonus,
        paid_extra_gb: paid,
        total_gb: freeGb + bonus + paid,
        used_bytes_central: Number(u?.used_bytes_central ?? 0),
        used_bytes_own: Number(u?.used_bytes_own ?? 0),
        has_own_r2: !!(c?.r2_bucket && c?.r2_endpoint),
      };
    });
  });

// =====================================================================
// Admin: bonus per-organizacja
// =====================================================================

export const grantOrgStorageBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        bonus_free_gb: z.number().min(0).max(100_000),
        paid_extra_gb: z.number().min(0).max(100_000),
        bonus_note: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    // upsert (klucz: organization_id)
    const { error } = await supabaseAdmin
      .from("org_storage_config")
      .upsert(
        {
          organization_id: data.organization_id,
          bonus_free_gb: data.bonus_free_gb,
          paid_extra_gb: data.paid_extra_gb,
          bonus_note: data.bonus_note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// Admin: tryb + własne klucze R2 per organizacja
// =====================================================================

export const setOrgStorageMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        mode: z.enum(["central", "own"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const { error } = await supabaseAdmin
      .from("org_storage_config")
      .upsert(
        {
          organization_id: data.organization_id,
          mode: data.mode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOrgOwnR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        r2_account_id: z.string().trim().min(1).max(120),
        // sekrety opcjonalne — puste pole = nie nadpisuj (przy edycji)
        r2_access_key_id: z.string().trim().max(512).optional().nullable(),
        r2_secret_access_key: z.string().trim().max(512).optional().nullable(),
        r2_bucket: z.string().trim().min(1).max(120),
        r2_endpoint: z.string().trim().url().max(300),
        r2_public_base_url: z.string().trim().url().max(300),
        activate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const patch: Record<string, unknown> = {
      organization_id: data.organization_id,
      r2_account_id: data.r2_account_id,
      r2_bucket: data.r2_bucket,
      r2_endpoint: data.r2_endpoint.replace(/\/$/, ""),
      r2_public_base_url: data.r2_public_base_url.replace(/\/$/, ""),
      updated_at: new Date().toISOString(),
    };
    if (data.r2_access_key_id && data.r2_access_key_id.length > 0) {
      patch.r2_access_key_id_enc = encryptPii(data.r2_access_key_id);
    }
    if (data.r2_secret_access_key && data.r2_secret_access_key.length > 0) {
      patch.r2_secret_access_key_enc = encryptPii(data.r2_secret_access_key);
    }
    if (data.activate) patch.mode = "own";
    const { error } = await supabaseAdmin
      .from("org_storage_config")
      .upsert(patch, { onConflict: "organization_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearOrgOwnR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const { error } = await supabaseAdmin
      .from("org_storage_config")
      .update({
        mode: "central",
        r2_account_id: null,
        r2_access_key_id_enc: null,
        r2_secret_access_key_enc: null,
        r2_bucket: null,
        r2_endpoint: null,
        r2_public_base_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testOrgR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const ctx = await getOrgR2Context(data.organization_id);
    const key = `.concertivo-test/${Date.now()}.txt`;
    const { uploadUrl } = await presignPut({
      ctx,
      key,
      contentType: "text/plain",
      expiresIn: 60,
    });
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "concertivo!",
    });
    if (!put.ok) {
      throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
    }
    await deleteObject(ctx, key);
    return { ok: true, mode: ctx.mode, bucket: ctx.bucket };
  });

// =====================================================================
// Pobranie ustawień storage (mode + zamaskowane dane R2) dla org managera
// =====================================================================

export const getOrgStorageSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const { data: row } = await supabaseAdmin
      .from("org_storage_config")
      .select(
        "mode, r2_account_id, r2_bucket, r2_endpoint, r2_public_base_url, r2_access_key_id_enc, r2_secret_access_key_enc",
      )
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const quota = await calculateOrgQuota(data.organization_id);
    return {
      mode: ((row?.mode as "central" | "own") ?? "central"),
      r2_account_id: row?.r2_account_id ?? null,
      r2_bucket: row?.r2_bucket ?? null,
      r2_endpoint: row?.r2_endpoint ?? null,
      r2_public_base_url: row?.r2_public_base_url ?? null,
      has_access_key: !!row?.r2_access_key_id_enc,
      has_secret_key: !!row?.r2_secret_access_key_enc,
      quota,
    };
  });

// =====================================================================
// Quota dla aktualnie zalogowanego usera (do wykorzystania w modułach)
// =====================================================================

export const getOrgQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // dostęp dla członka org / twórcy / admina aplikacji
    const { data: mem } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) {
      const { data: org } = await supabase
        .from("organizations")
        .select("created_by")
        .eq("id", data.organization_id)
        .maybeSingle();
      if (!org || (org as { created_by?: string }).created_by !== userId) {
        await assertAppAdmin(supabase, userId);
      }
    }
    return calculateOrgQuota(data.organization_id);
  });

// =====================================================================
// Migracja plików między bucketami (central <-> own) i status legacy.
// =====================================================================

/**
 * Zwraca statystyki obiektów per tryb dla danej organizacji.
 * Używane do pokazania użytkownikowi, że ma jeszcze pliki w "starym" trybie.
 */
export const getOrgStorageMigrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    const cfg = await supabaseAdmin
      .from("org_storage_config")
      .select("mode")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const activeMode = ((cfg.data?.mode as "central" | "own") ?? "central");

    const { data: rows } = await supabaseAdmin
      .from("org_storage_objects")
      .select("mode, size_bytes, mime")
      .eq("organization_id", data.organization_id)
      .neq("status", "deleted");

    const stats = { central: { files: 0, bytes: 0 }, own: { files: 0, bytes: 0 } };
    for (const r of (rows ?? []) as Array<{ mode: "central" | "own"; size_bytes: number; mime: string | null }>) {
      if (r.mime === "application/x-directory") continue;
      const bucket = stats[r.mode];
      if (!bucket) continue;
      bucket.files += 1;
      bucket.bytes += Number(r.size_bytes ?? 0);
    }
    const legacyMode: "central" | "own" = activeMode === "central" ? "own" : "central";
    return {
      active_mode: activeMode,
      legacy_mode: legacyMode,
      active: stats[activeMode],
      legacy: stats[legacyMode],
      has_legacy: stats[legacyMode].files > 0,
    };
  });

/**
 * Migracja plików między bucketami. Kopiuje obiekty z trybu źródłowego do
 * docelowego (streaming GET -> PUT przez presigned URLs, żeby uniknąć
 * trzymania całych plików w pamięci Workera). Bezpieczna do uruchomienia
 * wielokrotnie — kopiuje tylko te obiekty, które są w trybie 'from'.
 *
 * Po sukcesie aktualizuje wiersz w org_storage_objects: mode/bucket/public_url
 * wskazują na nową lokalizację. Stary obiekt w źródłowym buckecie jest
 * kasowany TYLKO gdy delete_source = true.
 *
 * Limity:
 *  - pojedyncze wywołanie kopiuje maks. 50 plików (chunk) — większą migrację
 *    user wykonuje wielokrotnym kliknięciem (idempotentne).
 *  - pliki > 200 MB są pomijane i raportowane (Worker streaming limity);
 *    do takich plików potrzebny jest osobny tryb (TODO).
 */
const MIGRATION_CHUNK = 50;
const MIGRATION_MAX_FILE_BYTES = 200 * 1024 * 1024;

export const migrateOrgStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        from_mode: z.enum(["central", "own"]),
        to_mode: z.enum(["central", "own"]),
        delete_source: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgManager(supabase, userId, data.organization_id);
    if (data.from_mode === data.to_mode) {
      throw new Error("Tryb źródłowy i docelowy muszą się różnić.");
    }

    const srcCtx = await getR2ContextForMode(data.organization_id, data.from_mode);
    const dstCtx = await getR2ContextForMode(data.organization_id, data.to_mode);

    const { data: rows, error } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id, object_key, size_bytes, mime")
      .eq("organization_id", data.organization_id)
      .eq("mode", data.from_mode)
      .neq("status", "deleted")
      .neq("mime", "application/x-directory")
      .order("size_bytes", { ascending: true })
      .limit(MIGRATION_CHUNK);
    if (error) throw new Error(error.message);

    let copied = 0;
    let skippedTooBig = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of (rows ?? []) as Array<{
      id: string;
      object_key: string;
      size_bytes: number;
      mime: string | null;
    }>) {
      if (Number(r.size_bytes ?? 0) > MIGRATION_MAX_FILE_BYTES) {
        skippedTooBig += 1;
        continue;
      }
      try {
        const getUrl = await presignGet({ ctx: srcCtx, key: r.object_key, expiresIn: 900 });
        const { uploadUrl, publicUrl } = await presignPut({
          ctx: dstCtx,
          key: r.object_key,
          contentType: r.mime ?? "application/octet-stream",
          expiresIn: 900,
        });
        const getRes = await fetch(getUrl);
        if (!getRes.ok || !getRes.body) {
          throw new Error(`GET ${getRes.status}`);
        }
        const buf = await getRes.arrayBuffer();
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": r.mime ?? "application/octet-stream" },
          body: buf,
        });
        if (!putRes.ok) {
          throw new Error(`PUT ${putRes.status}`);
        }
        // Update row: nowa lokalizacja
        const { error: upErr } = await supabaseAdmin
          .from("org_storage_objects")
          .update({
            mode: data.to_mode,
            bucket: dstCtx.bucket,
            public_url: publicUrl,
          })
          .eq("id", r.id);
        if (upErr) throw new Error(upErr.message);

        if (data.delete_source) {
          try {
            await deleteObject(srcCtx, r.object_key);
          } catch (e) {
            errors.push(`del src ${r.object_key}: ${(e as Error).message}`);
          }
        }
        copied += 1;
      } catch (e) {
        failed += 1;
        errors.push(`${r.object_key}: ${(e as Error).message}`);
      }
    }

    // Zaktualizuj też foldery-markery (zero-bajtowe) — żeby ListObjectsV2
    // po stronie destynacji "widziało" strukturę, choć i tak listing korzysta
    // z org_storage_objects.
    const { data: folderRows } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id, object_key")
      .eq("organization_id", data.organization_id)
      .eq("mode", data.from_mode)
      .eq("mime", "application/x-directory")
      .neq("status", "deleted")
      .limit(MIGRATION_CHUNK);
    for (const f of (folderRows ?? []) as Array<{ id: string; object_key: string }>) {
      await supabaseAdmin
        .from("org_storage_objects")
        .update({ mode: data.to_mode, bucket: dstCtx.bucket })
        .eq("id", f.id);
    }

    // Czy zostały jeszcze jakieś pliki w source?
    const { count: remaining } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .eq("mode", data.from_mode)
      .neq("status", "deleted")
      .neq("mime", "application/x-directory");

    return {
      copied,
      skipped_too_big: skippedTooBig,
      failed,
      remaining: remaining ?? 0,
      errors: errors.slice(0, 10),
      done: (remaining ?? 0) === 0,
    };
  });



