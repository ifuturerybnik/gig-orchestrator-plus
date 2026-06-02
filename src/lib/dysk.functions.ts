// Moduł "Dysk" — proste zarządzanie plikami i folderami per organizacja.
// Używa istniejącej tabeli public.org_storage_objects (module='dysk') oraz R2.
//
// Konwencja kluczy:
//   plik:   dysk/{orgId}/{path}/{filename}   (path może być pusty -> "dysk/{orgId}/{filename}")
//   folder: dysk/{orgId}/{path}/             (trailing slash, mime='application/x-directory', brak obiektu w R2)

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
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";

const FOLDER_MIME = "application/x-directory";

// ---------- helpers ----------

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

function normalizePath(p: string): string {
  // bez wiodącego/koncowego "/", brak ".." segmentów, brak pustych segmentów
  const parts = (p ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..");
  return parts.join("/");
}

function sanitizeName(name: string): string {
  // tylko nazwa, bez slashy
  const cleaned = name.replace(/[\\/]+/g, "_").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Nieprawidłowa nazwa");
  }
  return cleaned;
}

function buildPrefix(orgId: string, path: string): string {
  return path ? `dysk/${orgId}/${path}/` : `dysk/${orgId}/`;
}

// ---------- list ----------

export type DyskEntry = {
  id: string;
  kind: "folder" | "file";
  name: string;
  path: string; // pełna ścieżka względna w obrębie /dysk organizacji (bez nazwy dla folderów = path samego siebie)
  size_bytes: number;
  mime: string | null;
  public_url: string | null;
  created_at: string;
};

export const listDysk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        path: z.string().max(1000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ entries: DyskEntry[]; path: string }> => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);
    const path = normalizePath(data.path);
    const prefix = buildPrefix(data.organization_id, path);

    const { data: rows, error } = await supabaseAdmin
      .from("org_storage_objects")
      .select("id, object_key, size_bytes, mime, public_url, created_at, status")
      .eq("organization_id", data.organization_id)
      .eq("module", "dysk")
      .neq("status", "deleted")
      .like("object_key", `${prefix}%`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const entries: DyskEntry[] = [];
    const seenFolders = new Set<string>();

    for (const r of (rows ?? []) as Array<{
      id: string;
      object_key: string;
      size_bytes: number;
      mime: string | null;
      public_url: string | null;
      created_at: string;
      status: string;
    }>) {
      const rel = r.object_key.slice(prefix.length);
      if (!rel) continue;
      // folder marker = "{folderName}/"
      if (r.mime === FOLDER_MIME && rel.endsWith("/") && rel.slice(0, -1).indexOf("/") === -1) {
        const name = rel.slice(0, -1);
        if (!seenFolders.has(name)) {
          seenFolders.add(name);
          entries.push({
            id: r.id,
            kind: "folder",
            name,
            path: path ? `${path}/${name}` : name,
            size_bytes: 0,
            mime: FOLDER_MIME,
            public_url: null,
            created_at: r.created_at,
          });
        }
        continue;
      }
      // bezpośredni plik w bieżącym folderze = rel bez "/"
      if (!rel.includes("/")) {
        entries.push({
          id: r.id,
          kind: "file",
          name: rel,
          path: path ? `${path}/${rel}` : rel,
          size_bytes: Number(r.size_bytes ?? 0),
          mime: r.mime,
          public_url: r.public_url,
          created_at: r.created_at,
        });
      } else {
        // głębszy plik -> wyciągnij wirtualny folder jeśli brak markera
        const firstSeg = rel.split("/")[0];
        if (firstSeg && !seenFolders.has(firstSeg)) {
          seenFolders.add(firstSeg);
          entries.push({
            id: `virtual:${firstSeg}`,
            kind: "folder",
            name: firstSeg,
            path: path ? `${path}/${firstSeg}` : firstSeg,
            size_bytes: 0,
            mime: FOLDER_MIME,
            public_url: null,
            created_at: r.created_at,
          });
        }
      }
    }

    // sortowanie: foldery alfabetycznie, potem pliki po dacie
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (a.kind === "folder") return a.name.localeCompare(b.name);
      return b.created_at.localeCompare(a.created_at);
    });

    return { entries, path };
  });

// ---------- create folder ----------

export const createDyskFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        path: z.string().max(1000).default(""),
        name: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);
    const path = normalizePath(data.path);
    const name = sanitizeName(data.name);
    const key = `${buildPrefix(data.organization_id, path)}${name}/`;

    const ctx = await getOrgR2Context(data.organization_id);
    const { error } = await supabaseAdmin
      .from("org_storage_objects")
      .insert({
        organization_id: data.organization_id,
        mode: ctx.mode,
        bucket: ctx.bucket,
        object_key: key,
        size_bytes: 0,
        mime: FOLDER_MIME,
        module: "dysk",
        status: "ready",
        created_by: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- upload: presign + confirm ----------

export const presignDyskUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        path: z.string().max(1000).default(""),
        filename: z.string().min(1).max(300),
        content_type: z.string().min(1).max(200),
        size_bytes: z.number().int().min(0).max(50 * 1024 ** 3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);
    const path = normalizePath(data.path);
    const name = sanitizeName(data.filename);

    // sprawdź kwotę
    const q = await calculateOrgQuota(data.organization_id);
    if (q.usedBytes + data.size_bytes > q.totalBytes) {
      throw new Error("Przekroczono limit miejsca dla tej organizacji.");
    }

    const ctx = await getOrgR2Context(data.organization_id);
    const key = `${buildPrefix(data.organization_id, path)}${name}`;
    const { uploadUrl, publicUrl } = await presignPut({
      ctx,
      key,
      contentType: data.content_type,
      expiresIn: 900,
    });

    const { data: row, error } = await supabaseAdmin
      .from("org_storage_objects")
      .insert({
        organization_id: data.organization_id,
        mode: ctx.mode,
        bucket: ctx.bucket,
        object_key: key,
        size_bytes: data.size_bytes,
        mime: data.content_type,
        module: "dysk",
        public_url: publicUrl,
        status: "pending",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { object_id: (row as { id: string }).id, uploadUrl, publicUrl };
  });

export const confirmDyskUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        object_id: z.string().uuid(),
        size_bytes: z.number().int().min(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: obj, error: getErr } = await supabaseAdmin
      .from("org_storage_objects")
      .select("organization_id, status")
      .eq("id", data.object_id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!obj) throw new Error("Obiekt nie istnieje");
    await assertOrgMember(
      supabase,
      userId,
      (obj as { organization_id: string }).organization_id,
    );

    const { error } = await supabaseAdmin
      .from("org_storage_objects")
      .update({ status: "ready", size_bytes: data.size_bytes })
      .eq("id", data.object_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- delete ----------

export const deleteDyskEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organization_id: z.string().uuid(),
        // jedno z: object_id (plik/folder marker) ALBO folder_path (folder wirtualny lub realny — kasuje wszystko z prefixem)
        object_id: z.string().uuid().optional(),
        folder_path: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);
    const ctx = await getOrgR2Context(data.organization_id);

    if (data.object_id) {
      const { data: obj, error } = await supabaseAdmin
        .from("org_storage_objects")
        .select("id, object_key, mime, organization_id, bucket")
        .eq("id", data.object_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!obj) throw new Error("Obiekt nie istnieje");
      const row = obj as {
        id: string;
        object_key: string;
        mime: string | null;
        organization_id: string;
        bucket: string;
      };
      if (row.organization_id !== data.organization_id) {
        throw new Error("Forbidden");
      }
      if (row.mime === FOLDER_MIME) {
        // skasuj wszystkie obiekty z prefixem (folder marker + zawartość)
        await deletePrefix(ctx, row.object_key);
        const { error: dErr } = await supabaseAdmin
          .from("org_storage_objects")
          .update({ status: "deleted" })
          .eq("organization_id", data.organization_id)
          .eq("module", "dysk")
          .like("object_key", `${row.object_key}%`);
        if (dErr) throw new Error(dErr.message);
      } else {
        await deleteObject(ctx, row.object_key);
        const { error: dErr } = await supabaseAdmin
          .from("org_storage_objects")
          .update({ status: "deleted" })
          .eq("id", row.id);
        if (dErr) throw new Error(dErr.message);
      }
      return { ok: true };
    }

    if (data.folder_path != null) {
      const path = normalizePath(data.folder_path);
      if (!path) throw new Error("Brak ścieżki folderu");
      const prefix = buildPrefix(data.organization_id, path);
      await deletePrefix(ctx, prefix);
      const { error: dErr } = await supabaseAdmin
        .from("org_storage_objects")
        .update({ status: "deleted" })
        .eq("organization_id", data.organization_id)
        .eq("module", "dysk")
        .like("object_key", `${prefix}%`);
      if (dErr) throw new Error(dErr.message);
      return { ok: true };
    }

    throw new Error("Podaj object_id albo folder_path");
  });

async function deletePrefix(
  ctx: Awaited<ReturnType<typeof getOrgR2Context>>,
  prefix: string,
): Promise<void> {
  let token: string | undefined = undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await ctx.client.send(
      new ListObjectsV2Command({
        Bucket: ctx.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys: string[] = (res.Contents ?? [])
      .map((o: { Key?: string }) => o.Key)
      .filter((k: string | undefined): k is string => !!k);
    if (keys.length > 0) {
      await ctx.client.send(
        new DeleteObjectsCommand({
          Bucket: ctx.bucket,
          Delete: { Objects: keys.map((Key: string) => ({ Key })) },
        }),
      );
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
    if (!token) break;
  }
}

// ---------- quota (re-export shortcut) ----------

export const getDyskQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOrgMember(supabase, userId, data.organization_id);
    return calculateOrgQuota(data.organization_id);
  });
