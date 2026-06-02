// SERVER-ONLY. Helpery do Cloudflare R2 (S3-compatible) — wspólne dla
// centralnego konta Concertivo i kont per-organizacja (Model 3).
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptPii } from "@/lib/crypto.server";

export type StorageMode = "central" | "own";

export type R2Context = {
  mode: StorageMode;
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
};

function buildClient(opts: {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: opts.endpoint,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
    forcePathStyle: false,
  });
}

export function getCentralR2(): {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
} {
  const accountId = process.env.EXT_R2_ACCOUNT_ID;
  const accessKeyId = process.env.EXT_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXT_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.EXT_R2_BUCKET;
  const publicBaseUrl = process.env.EXT_R2_PUBLIC_BASE_URL;
  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicBaseUrl
  ) {
    throw new Error(
      "Centralny Cloudflare R2 nie jest skonfigurowany (brak EXT_R2_*).",
    );
  }
  return {
    client: buildClient({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKeyId,
      secretAccessKey,
    }),
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  };
}

export function checkCentralSecretsPresence() {
  return {
    EXT_R2_ACCOUNT_ID: !!process.env.EXT_R2_ACCOUNT_ID,
    EXT_R2_ACCESS_KEY_ID: !!process.env.EXT_R2_ACCESS_KEY_ID,
    EXT_R2_SECRET_ACCESS_KEY: !!process.env.EXT_R2_SECRET_ACCESS_KEY,
    EXT_R2_BUCKET: !!process.env.EXT_R2_BUCKET,
    EXT_R2_PUBLIC_BASE_URL: !!process.env.EXT_R2_PUBLIC_BASE_URL,
  };
}

export type OrgStorageConfigRow = {
  organization_id: string;
  mode: StorageMode;
  bonus_free_gb: number;
  paid_extra_gb: number;
  bonus_note: string | null;
  r2_account_id: string | null;
  r2_access_key_id_enc: string | null;
  r2_secret_access_key_enc: string | null;
  r2_bucket: string | null;
  r2_endpoint: string | null;
  r2_public_base_url: string | null;
};

export async function getOrgStorageConfigRow(
  organizationId: string,
): Promise<OrgStorageConfigRow> {
  const { data, error } = await supabaseAdmin
    .from("org_storage_config")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as OrgStorageConfigRow;
  // Auto-create domyślny wiersz (central).
  const insert = {
    organization_id: organizationId,
    mode: "central" as const,
    bonus_free_gb: 0,
    paid_extra_gb: 0,
  };
  const { data: created, error: insErr } = await supabaseAdmin
    .from("org_storage_config")
    .insert(insert)
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  return created as OrgStorageConfigRow;
}

export async function getOrgR2Context(
  organizationId: string,
): Promise<R2Context> {
  const cfg = await getOrgStorageConfigRow(organizationId);
  if (cfg.mode === "own") {
    if (
      !cfg.r2_endpoint ||
      !cfg.r2_bucket ||
      !cfg.r2_access_key_id_enc ||
      !cfg.r2_secret_access_key_enc ||
      !cfg.r2_public_base_url
    ) {
      throw new Error(
        "Tryb 'własne R2' wybrany, ale konfiguracja nie jest kompletna.",
      );
    }
    const accessKeyId = decryptPii(cfg.r2_access_key_id_enc);
    const secretAccessKey = decryptPii(cfg.r2_secret_access_key_enc);
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Nie udało się odszyfrować kluczy R2 organizacji.");
    }
    return {
      mode: "own",
      client: buildClient({
        endpoint: cfg.r2_endpoint,
        accessKeyId,
        secretAccessKey,
      }),
      bucket: cfg.r2_bucket,
      publicBaseUrl: cfg.r2_public_base_url.replace(/\/$/, ""),
    };
  }
  const central = getCentralR2();
  return { mode: "central", ...central };
}

export async function presignPut(opts: {
  ctx: R2Context;
  key: string;
  contentType: string;
  contentLength?: number;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const expiresIn = opts.expiresIn ?? 900; // 15 min
  const cmd = new PutObjectCommand({
    Bucket: opts.ctx.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  const uploadUrl = await getSignedUrl(opts.ctx.client, cmd, { expiresIn });
  const publicUrl = `${opts.ctx.publicBaseUrl}/${opts.key}`;
  return { uploadUrl, publicUrl, expiresIn };
}

export async function deleteObject(
  ctx: R2Context,
  key: string,
): Promise<void> {
  await ctx.client.send(
    new DeleteObjectCommand({ Bucket: ctx.bucket, Key: key }),
  );
}

export async function headObject(
  ctx: R2Context,
  key: string,
): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await ctx.client.send(
      new HeadObjectCommand({ Bucket: ctx.bucket, Key: key }),
    );
    return {
      size: Number(res.ContentLength ?? 0),
      contentType: res.ContentType,
    };
  } catch {
    return null;
  }
}

export type GlobalCfg = {
  free_quota_gb: number;
  price_per_extra_gb_pln: number;
  max_image_mb: number;
  max_video_mb: number;
  central_enabled: boolean;
};

export async function getGlobalCfg(): Promise<GlobalCfg> {
  const { data } = await supabaseAdmin
    .from("storage_global_config")
    .select(
      "free_quota_gb, price_per_extra_gb_pln, max_image_mb, max_video_mb, central_enabled",
    )
    .eq("id", 1)
    .maybeSingle();
  return (data as GlobalCfg | null) ?? {
    free_quota_gb: 2,
    price_per_extra_gb_pln: 0.25,
    max_image_mb: 50,
    max_video_mb: 200,
    central_enabled: true,
  };
}

export async function getOrgUsageBytes(
  organizationId: string,
): Promise<{ used_bytes_central: number; used_bytes_own: number; objects_count: number }> {
  const { data } = await supabaseAdmin
    .from("org_storage_usage")
    .select("used_bytes_central, used_bytes_own, objects_count")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (data as {
    used_bytes_central: number;
    used_bytes_own: number;
    objects_count: number;
  } | null) ?? { used_bytes_central: 0, used_bytes_own: 0, objects_count: 0 };
}

export async function calculateOrgQuota(organizationId: string) {
  const [g, cfg, usage] = await Promise.all([
    getGlobalCfg(),
    getOrgStorageConfigRow(organizationId),
    getOrgUsageBytes(organizationId),
  ]);
  const freeGb = Number(g.free_quota_gb || 0);
  const bonusGb = Number(cfg.bonus_free_gb || 0);
  const paidGb = Number(cfg.paid_extra_gb || 0);
  const totalGb = freeGb + bonusGb + paidGb;
  const totalBytes = Math.round(totalGb * 1024 ** 3);
  const usedBytes =
    cfg.mode === "central" ? usage.used_bytes_central : usage.used_bytes_own;
  return {
    mode: cfg.mode as StorageMode,
    freeGb,
    bonusGb,
    paidGb,
    totalGb,
    totalBytes,
    usedBytes,
    remainingBytes: Math.max(0, totalBytes - usedBytes),
    pricePerExtraGbPln: Number(g.price_per_extra_gb_pln || 0),
  };
}
