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
  presignPut,
  deleteObject,
  calculateOrgQuota,
  getGlobalCfg,
} from "@/lib/storage-r2.server";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";


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
    const { error } = await _supabaseAdmin
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
    const { error } = await _supabaseAdmin
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
    const { error } = await _supabaseAdmin
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
      contentLength: 12,
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
    await assertAppAdmin(supabase, userId);
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
        r2_account_id: z.string().min(1).max(120),
        r2_access_key_id: z.string().min(1).max(512),
        r2_secret_access_key: z.string().min(1).max(512),
        r2_bucket: z.string().min(1).max(120),
        r2_endpoint: z.string().url().max(300),
        r2_public_base_url: z.string().url().max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAppAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("org_storage_config")
      .upsert(
        {
          organization_id: data.organization_id,
          r2_account_id: data.r2_account_id,
          r2_access_key_id_enc: encryptPii(data.r2_access_key_id),
          r2_secret_access_key_enc: encryptPii(data.r2_secret_access_key),
          r2_bucket: data.r2_bucket,
          r2_endpoint: data.r2_endpoint,
          r2_public_base_url: data.r2_public_base_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
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
    await assertAppAdmin(supabase, userId);
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
    await assertAppAdmin(supabase, userId);
    const ctx = await getOrgR2Context(data.organization_id);
    const key = `.concertivo-test/${Date.now()}.txt`;
    const { uploadUrl } = await presignPut({
      ctx,
      key,
      contentType: "text/plain",
      contentLength: 12,
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

