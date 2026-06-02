// Upload obrazów dla modułu Web (news/events/gallery).
// Klient przed wysłaniem dzieli obraz na 3 warianty (WebP): original/medium/thumb.
// Każdy wariant jest osobnym wierszem w org_storage_objects;
// thumb/medium mają parent_id wskazujący na wiersz 'original'.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getOrgR2Context,
  presignPut,
  deleteObject,
  calculateOrgQuota,
} from "@/lib/storage-r2.server";

async function assertOrgMember(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
) {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mem) return;
  const { data: org } = await supabase
    .from("organizations")
    .select("created_by")
    .eq("id", organizationId)
    .maybeSingle();
  if (org && (org as { created_by?: string }).created_by === userId) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const rs = ((roles ?? []) as Array<{ role: string }>).map((r) => r.role);
  if (rs.includes("super_admin") || rs.includes("admin_staff")) return;
  throw new Error("Forbidden");
}

const VariantEnum = z.enum(["original", "medium", "thumb"]);

export const presignWebImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        module: z.enum(["web-news", "web-events", "web-gallery"]),
        upload_id: z.string().min(8).max(64), // wspólny prefiks dla 3 wariantów
        variants: z
          .array(
            z.object({
              variant: VariantEnum,
              content_type: z.string().min(1).max(120),
              size_bytes: z.number().int().min(1).max(50 * 1024 * 1024),
              width: z.number().int().min(1).max(20000),
              height: z.number().int().min(1).max(20000),
            }),
          )
          .min(1)
          .max(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);

    // sprawdź kwotę (suma wszystkich wariantów)
    const total = data.variants.reduce((s, v) => s + v.size_bytes, 0);
    const q = await calculateOrgQuota(data.organization_id);
    if (q.usedBytes + total > q.totalBytes) {
      throw new Error("Przekroczono limit miejsca dla tej organizacji.");
    }

    const ctx = await getOrgR2Context(data.organization_id);
    const prefix = `${data.module}/${data.organization_id}/${data.upload_id}`;

    // 1) Zarejestruj wszystkie 3 wiersze (pending). Najpierw 'original' żeby
    // złapać id i przypiąć do thumb/medium jako parent_id.
    const original = data.variants.find((v) => v.variant === "original");
    if (!original) throw new Error("Wymagany jest wariant 'original'.");

    const originalKey = `${prefix}/original.webp`;
    const { data: originalRow, error: insErr } = await supabaseAdmin
      .from("org_storage_objects")
      .insert({
        organization_id: data.organization_id,
        mode: ctx.mode,
        bucket: ctx.bucket,
        object_key: originalKey,
        size_bytes: original.size_bytes,
        mime: original.content_type,
        module: data.module,
        width: original.width,
        height: original.height,
        variant: "original",
        public_url: `${ctx.publicBaseUrl}/${originalKey}`,
        status: "pending",
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    const originalId = (originalRow as { id: string }).id;

    const results: Array<{
      variant: "original" | "medium" | "thumb";
      object_id: string;
      uploadUrl: string;
      publicUrl: string;
      key: string;
    }> = [];

    // presign dla original
    {
      const { uploadUrl, publicUrl } = await presignPut({
        ctx,
        key: originalKey,
        contentType: original.content_type,
        expiresIn: 900,
      });
      results.push({
        variant: "original",
        object_id: originalId,
        uploadUrl,
        publicUrl,
        key: originalKey,
      });
    }

    // pozostałe warianty
    for (const v of data.variants) {
      if (v.variant === "original") continue;
      const key = `${prefix}/${v.variant}.webp`;
      const { data: row, error } = await supabaseAdmin
        .from("org_storage_objects")
        .insert({
          organization_id: data.organization_id,
          mode: ctx.mode,
          bucket: ctx.bucket,
          object_key: key,
          size_bytes: v.size_bytes,
          mime: v.content_type,
          module: data.module,
          width: v.width,
          height: v.height,
          variant: v.variant,
          parent_id: originalId,
          public_url: `${ctx.publicBaseUrl}/${key}`,
          status: "pending",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { uploadUrl, publicUrl } = await presignPut({
        ctx,
        key,
        contentType: v.content_type,
        expiresIn: 900,
      });
      results.push({
        variant: v.variant,
        object_id: (row as { id: string }).id,
        uploadUrl,
        publicUrl,
        key,
      });
    }

    return { variants: results };
  });

export const confirmWebImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        object_ids: z.array(z.string().uuid()).min(1).max(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // znajdź org_id z pierwszego, sprawdź członkostwo
    const { data: rows, error: gErr } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id, organization_id")
      .in("id", data.object_ids);
    if (gErr) throw new Error(gErr.message);
    if (!rows || rows.length === 0) throw new Error("Obiekty nie istnieją.");
    const orgIds = new Set(rows.map((r) => (r as { organization_id: string }).organization_id));
    if (orgIds.size !== 1) throw new Error("Obiekty z różnych organizacji.");
    const orgId = [...orgIds][0];
    await assertOrgMember(supabase, userId, orgId);

    const { error } = await supabaseAdmin
      .from("org_storage_objects")
      .update({ status: "ready" })
      .in("id", data.object_ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebImageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ object_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: gErr } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id, organization_id, object_key, variant")
      .eq("id", data.object_id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row) return { ok: true };
    const r = row as {
      id: string;
      organization_id: string;
      object_key: string;
      variant: string;
    };
    await assertOrgMember(supabase, userId, r.organization_id);

    // jeśli usuwamy 'original' — pociągnij też dzieci
    const ids: string[] = [r.id];
    const keys: string[] = [r.object_key];
    if (r.variant === "original") {
      const { data: kids } = await supabaseAdmin
        .from("org_storage_objects")
        .select("id, object_key")
        .eq("parent_id", r.id);
      for (const k of (kids ?? []) as Array<{ id: string; object_key: string }>) {
        ids.push(k.id);
        keys.push(k.object_key);
      }
    }

    const ctx = await getOrgR2Context(r.organization_id);
    for (const k of keys) {
      try {
        await deleteObject(ctx, k);
      } catch {
        // best-effort
      }
    }
    await supabaseAdmin
      .from("org_storage_objects")
      .update({ status: "deleted" })
      .in("id", ids);
    return { ok: true };
  });
