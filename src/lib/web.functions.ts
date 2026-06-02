import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyWebhooks } from "@/lib/web-webhooks.server";


// ============================================================
// Helpers
// ============================================================

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `item-${Date.now().toString(36)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const I18nString = z
  .record(z.string(), z.string().max(20000))
  .default({});

// ============================================================
// Public settings (slug + publish state)
// ============================================================

export const getWebSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: settings, error } = await supabase
      .from("org_public_settings")
      .select("*")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings };
  });

const upsertSettingsInput = z.object({
  organizationId: z.string().uuid(),
  publicSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug: małe litery, cyfry, myślniki"),
  isPublished: z.boolean(),
  defaultLang: z.enum(["pl", "en"]).default("pl"),
  availableLangs: z.array(z.enum(["pl", "en"])).min(1).default(["pl", "en"]),
});

export const upsertWebSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => upsertSettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("org_public_settings").upsert(
      {
        organization_id: data.organizationId,
        public_slug: data.publicSlug,
        is_published: data.isPublished,
        default_lang: data.defaultLang,
        available_langs: data.availableLangs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// API Tokens
// ============================================================

export const listWebTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tokens, error } = await supabase
      .from("org_public_tokens")
      .select("id, name, token_prefix, scopes, last_used_at, revoked_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tokens: tokens ?? [] };
  });

export const createWebToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 8);
    const { error } = await supabase.from("org_public_tokens").insert({
      organization_id: data.organizationId,
      name: data.name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    // Zwracamy token TYLKO TU — w bazie zapisany jest tylko hash
    return { token, prefix: tokenPrefix };
  });

export const revokeWebToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ tokenId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("org_public_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Domains
// ============================================================

export const listWebDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: domains, error } = await supabase
      .from("org_public_domains")
      .select("id, domain, created_at")
      .eq("organization_id", data.organizationId)
      .order("domain");
    if (error) throw new Error(error.message);
    return { domains: domains ?? [] };
  });

export const addWebDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organizationId: z.string().uuid(),
        domain: z
          .string()
          .trim()
          .min(3)
          .max(253)
          .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Niepoprawna domena (np. example.com)")
          .transform((s) => s.toLowerCase()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("org_public_domains").insert({
      organization_id: data.organizationId,
      domain: data.domain,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWebDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("org_public_domains")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// NEWS — Aktualności
// ============================================================

export const listWebNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: news, error } = await supabase
      .from("web_news")
      .select(
        "id, slug, title_i18n, excerpt_i18n, cover_image_url, is_public, published_at, updated_at, tags",
      )
      .eq("organization_id", data.organizationId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { news: news ?? [] };
  });

export const getWebNewsItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: item, error } = await supabase
      .from("web_news")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { item };
  });

const newsUpsertInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  slug: z.string().trim().max(80).optional(),
  titleI18n: I18nString,
  excerptI18n: I18nString,
  contentHtmlI18n: I18nString,
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  galleryImageUrls: z.array(z.string().url().max(2048)).max(50).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  authorName: z.string().trim().max(120).nullable().optional(),
  isPublic: z.boolean().default(false),
  publishedAt: z.string().nullable().optional(),
});

export const upsertWebNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => newsUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const titlePl = (data.titleI18n as Record<string, string>).pl ?? Object.values(data.titleI18n)[0] ?? "";
    const slug = data.slug?.trim() || slugify(titlePl);
    const payload = {
      organization_id: data.organizationId,
      slug,
      title_i18n: data.titleI18n,
      excerpt_i18n: data.excerptI18n,
      content_html_i18n: data.contentHtmlI18n,
      cover_image_url: data.coverImageUrl ?? null,
      gallery_image_urls: data.galleryImageUrls,
      tags: data.tags,
      author_name: data.authorName ?? null,
      is_public: data.isPublic,
      published_at: data.publishedAt ?? (data.isPublic ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("web_news").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await notifyWebhooks(data.organizationId, data.isPublic ? "news.published" : "news.updated", {
        id: data.id,
        slug,
        organization_id: data.organizationId,
      });
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("web_news")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyWebhooks(data.organizationId, data.isPublic ? "news.published" : "news.updated", {
      id: inserted.id,
      slug,
      organization_id: data.organizationId,
    });
    return { id: inserted.id };
  });

export const deleteWebNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("web_news")
      .select("organization_id, slug")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("web_news").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.organization_id) {
      await notifyWebhooks(row.organization_id as string, "news.deleted", {
        id: data.id,
        slug: row.slug,
        organization_id: row.organization_id,
      });
    }
    return { ok: true };
  });

// ============================================================
// EVENTS — Wydarzenia
// ============================================================

export const WEB_EVENT_STATUSES = [
  "scheduled",
  "cancelled",
  "postponed",
  "sold_out",
] as const;
export type WebEventStatus = (typeof WEB_EVENT_STATUSES)[number];

export const listWebEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: events, error } = await supabase
      .from("web_events")
      .select(
        "id, slug, title_i18n, cover_image_url, starts_at, ends_at, timezone, location_name_i18n, location_address, status, is_public, ticket_url",
      )
      .eq("organization_id", data.organizationId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

export const getWebEventItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: item, error } = await supabase
      .from("web_events")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { item };
  });

const eventUpsertInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  slug: z.string().trim().max(80).optional(),
  titleI18n: I18nString,
  descriptionHtmlI18n: I18nString,
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  timezone: z.string().min(1).max(60).default("Europe/Warsaw"),
  locationNameI18n: I18nString,
  locationAddress: z.string().trim().max(500).nullable().optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  performers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        url: z.string().url().max(2048).optional().or(z.literal("")),
      }),
    )
    .max(50)
    .default([]),
  ticketUrl: z.string().url().max(2048).nullable().optional().or(z.literal("")),
  ticketPriceFrom: z.number().nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
  status: z.enum(WEB_EVENT_STATUSES).default("scheduled"),
  isPublic: z.boolean().default(false),
});

export const upsertWebEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => eventUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const titlePl = (data.titleI18n as Record<string, string>).pl ?? Object.values(data.titleI18n)[0] ?? "";
    const slug = data.slug?.trim() || slugify(titlePl);
    const payload = {
      organization_id: data.organizationId,
      slug,
      title_i18n: data.titleI18n,
      description_html_i18n: data.descriptionHtmlI18n,
      cover_image_url: data.coverImageUrl ?? null,
      starts_at: data.startsAt,
      ends_at: data.endsAt ?? null,
      timezone: data.timezone,
      location_name_i18n: data.locationNameI18n,
      location_address: data.locationAddress ?? null,
      location_lat: data.locationLat ?? null,
      location_lng: data.locationLng ?? null,
      performers: data.performers,
      ticket_url: data.ticketUrl || null,
      ticket_price_from: data.ticketPriceFrom ?? null,
      currency: data.currency ?? null,
      status: data.status,
      is_public: data.isPublic,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("web_events").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await notifyWebhooks(data.organizationId, data.isPublic ? "event.published" : "event.updated", {
        id: data.id, slug, organization_id: data.organizationId, starts_at: data.startsAt,
      });
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("web_events")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyWebhooks(data.organizationId, data.isPublic ? "event.published" : "event.updated", {
      id: inserted.id, slug, organization_id: data.organizationId, starts_at: data.startsAt,
    });
    return { id: inserted.id };
  });

export const deleteWebEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("web_events").select("organization_id, slug").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("web_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.organization_id) {
      await notifyWebhooks(row.organization_id as string, "event.deleted", {
        id: data.id, slug: row.slug, organization_id: row.organization_id,
      });
    }
    return { ok: true };
  });


// ============================================================
// GALLERY — Albumy + pozycje
// ============================================================

export const listWebAlbums = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: albums, error } = await supabase
      .from("web_gallery_albums")
      .select(
        "id, slug, title_i18n, description_i18n, cover_image_url, event_id, is_public, published_at, updated_at",
      )
      .eq("organization_id", data.organizationId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { albums: albums ?? [] };
  });

export const getWebAlbum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [album, items] = await Promise.all([
      supabase.from("web_gallery_albums").select("*").eq("id", data.id).single(),
      supabase
        .from("web_gallery_items")
        .select("*")
        .eq("album_id", data.id)
        .order("sort_order"),
    ]);
    if (album.error) throw new Error(album.error.message);
    if (items.error) throw new Error(items.error.message);
    return { album: album.data, items: items.data ?? [] };
  });

const albumUpsertInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  slug: z.string().trim().max(80).optional(),
  titleI18n: I18nString,
  descriptionI18n: I18nString,
  coverImageUrl: z.string().url().max(2048).nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  isPublic: z.boolean().default(false),
  publishedAt: z.string().nullable().optional(),
});

export const upsertWebAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => albumUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const titlePl = (data.titleI18n as Record<string, string>).pl ?? Object.values(data.titleI18n)[0] ?? "";
    const slug = data.slug?.trim() || slugify(titlePl);
    const payload = {
      organization_id: data.organizationId,
      slug,
      title_i18n: data.titleI18n,
      description_i18n: data.descriptionI18n,
      cover_image_url: data.coverImageUrl ?? null,
      event_id: data.eventId ?? null,
      is_public: data.isPublic,
      published_at: data.publishedAt ?? (data.isPublic ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase
        .from("web_gallery_albums")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await notifyWebhooks(data.organizationId, data.isPublic ? "album.published" : "album.updated", {
        id: data.id, slug, organization_id: data.organizationId,
      });
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("web_gallery_albums")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await notifyWebhooks(data.organizationId, data.isPublic ? "album.published" : "album.updated", {
      id: inserted.id, slug, organization_id: data.organizationId,
    });
    return { id: inserted.id };
  });

export const deleteWebAlbum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("web_gallery_albums").select("organization_id, slug").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("web_gallery_albums").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.organization_id) {
      await notifyWebhooks(row.organization_id as string, "album.deleted", {
        id: data.id, slug: row.slug, organization_id: row.organization_id,
      });
    }
    return { ok: true };
  });


const itemUpsertInput = z.object({
  id: z.string().uuid().optional(),
  albumId: z.string().uuid(),
  organizationId: z.string().uuid(),
  kind: z.enum(["image", "video"]).default("image"),
  url: z.string().url().max(2048),
  urlThumb: z.string().url().max(2048).nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  durationS: z.number().int().nullable().optional(),
  captionI18n: I18nString,
  photoCredit: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const upsertWebGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => itemUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      album_id: data.albumId,
      organization_id: data.organizationId,
      kind: data.kind,
      url: data.url,
      url_thumb: data.urlThumb ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      duration_s: data.durationS ?? null,
      caption_i18n: data.captionI18n,
      photo_credit: data.photoCredit ?? null,
      sort_order: data.sortOrder,
    };
    if (data.id) {
      const { error } = await supabase
        .from("web_gallery_items")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("web_gallery_items")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteWebGalleryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("web_gallery_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// WEBHOOKS
// ============================================================

function randomSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const WEB_WEBHOOK_EVENTS = [
  "news.published","news.updated","news.deleted",
  "event.published","event.updated","event.deleted",
  "album.published","album.updated","album.deleted",
] as const;

export const listWebWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: hooks, error } = await supabase
      .from("web_webhooks")
      .select("id, name, target_url, events, is_active, created_at, updated_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { hooks: hooks ?? [] };
  });

const webhookUpsertInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  targetUrl: z.string().url().max(2048),
  events: z.array(z.enum(WEB_WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().default(true),
});

export const upsertWebWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => webhookUpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("web_webhooks").update({
        name: data.name,
        target_url: data.targetUrl,
        events: data.events,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, secret: null as string | null };
    }
    const secret = randomSecret();
    const { data: ins, error } = await supabase.from("web_webhooks").insert({
      organization_id: data.organizationId,
      name: data.name,
      target_url: data.targetUrl,
      secret,
      events: data.events,
      is_active: data.isActive,
      created_by: userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id, secret };
  });

export const deleteWebWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("web_webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWebWebhookDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { webhookId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("web_webhook_deliveries")
      .select("id, event, status_code, ok, error, duration_ms, created_at")
      .eq("webhook_id", data.webhookId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { deliveries: rows ?? [] };
  });

export const revealWebWebhookSecret = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("web_webhooks").select("secret").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return { secret: row.secret as string };
  });
