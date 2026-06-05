// SERVER-ONLY. Meta Graph API — wspólne helpery + adaptery Facebook i Instagram.
//
// JEDEN OAuth flow (Facebook Login) → Page Access Token (long-lived, ~brak expiry)
// + (opcjonalnie) Instagram Business Account ID powiązany ze stroną.
//
// Endpointy:
//  - GET  /v20.0/oauth/access_token                         — code → user token
//  - GET  /v20.0/oauth/access_token?grant_type=fb_exchange  — long-lived user token (60d)
//  - GET  /v20.0/me/accounts?fields=...                     — listing stron + IG
//  - POST /v20.0/{page-id}/feed                             — FB tekst
//  - POST /v20.0/{page-id}/photos                           — FB obrazek
//  - POST /v20.0/{ig-user-id}/media                         — IG: utwórz kontener
//  - POST /v20.0/{ig-user-id}/media_publish                 — IG: publikuj
//  - GET  /v20.0/{post-id}?fields=likes,comments,shares     — FB metryki
//  - GET  /v20.0/{media-id}/insights?metric=...             — IG metryki
//  - GET  /v20.0/{post-id|media-id}/comments                — komentarze
//  - POST /v20.0/{comment-id}/comments                      — FB odpowiedź
//  - POST /v20.0/{comment-id}/replies                       — IG odpowiedź

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPostContent,
  PlatformPublishResult,
  PlatformRecentPost,
  PlatformReplyResult,
} from "./types";

const GRAPH = "https://graph.facebook.com/v20.0";
// graph.instagram.com obsługuje wersje v22.0 / v23.0; v25.0 zwraca 400 dla części endpointów,
// dlatego trzymamy się stabilnej v22.0 dla Instagram Login API.
const INSTAGRAM_GRAPH = "https://graph.instagram.com/v22.0";

function igApiBases(account: PlatformAccount): string[] {
  return isInstagramLoginAccount(account) ? [INSTAGRAM_GRAPH] : [GRAPH];
}

function isInstagramLoginAccount(account: PlatformAccount): boolean {
  const scopes = account.scopes ?? [];
  return !!account.token_expires_at && scopes.some((s) => s.startsWith("instagram_business_"));
}

function describeMetaCommentPermission(account: PlatformAccount): string {
  return isInstagramLoginAccount(account)
    ? "instagram_business_manage_comments"
    : "instagram_manage_comments";
}

function explainMetaCommentPermissionError(account: PlatformAccount, action: string): string {
  const requiredScope = describeMetaCommentPermission(account);
  const currentScopes = account.scopes?.length ? account.scopes.join(", ") : "—";
  const connectHint = isInstagramLoginAccount(account)
    ? "Rozłącz Instagram i połącz go ponownie przyciskiem „Połącz z Instagram”, akceptując uprawnienie do zarządzania komentarzami."
    : "Tego konta Instagram nie można obsługiwać przez token Facebooka. Rozłącz Instagram i połącz go osobnym przyciskiem „Połącz z Instagram”, akceptując instagram_business_manage_comments.";
  return `${action}: Meta odrzuciła operację z powodu brakującego uprawnienia ${requiredScope}. Aktualne scope'y konta: [${currentScopes}]. ${connectHint}`;
}

export class MetaPermissionError extends Error {
  readonly code = "META_PERMISSION_REQUIRED";

  constructor(context: string) {
    super(
      `${context}: Meta nie udostępnia jeszcze metryk/komentarzy dla tej aplikacji. ` +
        "Import postów działa, ale polubienia/komentarze Facebook Page mogą wymagać zatwierdzonego pages_read_engagement lub Page Public Content Access w Meta App Review.",
    );
    this.name = "MetaPermissionError";
  }
}

function isMetaEngagementPermissionError(status: number, body: string): boolean {
  if (status !== 400 && status !== 403) return false;
  const isKnownPermissionCode =
    body.includes("(#10)") ||
    body.includes('"code":10') ||
    body.includes('"code":200') ||
    body.includes('"code":283');
  const mentionsMissingPermission =
    /requires?\s+.*permission/i.test(body) ||
    /extended permission/i.test(body) ||
    /Permissions error/i.test(body) ||
    /Page Public Content Access/i.test(body) ||
    /requires?\s+.*pages_read_engagement/i.test(body);
  return isKnownPermissionCode && mentionsMissingPermission;
}

function isMetaMissingPermissionError(message: string): boolean {
  return /Missing Permission|Permissions error|requires? .*permission|OAuthException.*"code":10|"code":10|\(#10\)/i.test(message);
}

function composeText(content: PlatformPostContent, maxLen: number): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join("\n\n");
  if (out.length > maxLen) return out.slice(0, maxLen - 3) + "…";
  return out;
}

function pickIgDisplayMediaUrl(args: {
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}): string | null {
  const mediaType = (args.mediaType ?? "").toUpperCase();
  if (mediaType === "VIDEO" || mediaType === "REELS") {
    return args.thumbnailUrl ?? args.mediaUrl ?? null;
  }
  return args.mediaUrl ?? args.thumbnailUrl ?? null;
}

function pickIgMediaItem(args: {
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}): { url: string; type: "image" | "video"; thumbnail_url?: string | null } | null {
  const mt = (args.mediaType ?? "").toUpperCase();
  if (mt === "VIDEO" || mt === "REELS") {
    const url = args.mediaUrl ?? args.thumbnailUrl;
    if (!url) return null;
    return { url, type: "video", thumbnail_url: args.thumbnailUrl ?? null };
  }
  const url = args.mediaUrl ?? args.thumbnailUrl;
  if (!url) return null;
  return { url, type: "image" };
}

type FbPostMediaShape = {
  full_picture?: string;
  picture?: string;
};

function pushUniqueUrl(urls: string[], url?: string | null): void {
  if (url && !urls.includes(url)) urls.push(url);
}

function collectFbMediaUrls(post: FbPostMediaShape): string[] {
  const urls: string[] = [];
  pushUniqueUrl(urls, post.full_picture);
  pushUniqueUrl(urls, post.picture);
  return urls;
}

async function fetchFbEdgeSummaryCount(args: {
  objectId: string;
  edge: "likes" | "comments";
  accessToken: string;
  context: string;
}): Promise<number> {
  const params = new URLSearchParams({
    limit: "0",
    summary: "total_count",
    access_token: args.accessToken,
  });
  const j = await graphJson<{ summary?: { total_count?: number } }>(
    `${GRAPH}/${encodeURIComponent(args.objectId)}/${args.edge}?${params.toString()}`,
    { context: args.context },
  );
  return j.summary?.total_count ?? 0;
}

async function graphJson<T = unknown>(
  url: string,
  init?: RequestInit & { context?: string },
): Promise<T> {
  const ctx = init?.context ?? "Meta API";
  const res = await fetch(url, init);
  const txt = await res.text();
  if (!res.ok) {
    if (isMetaEngagementPermissionError(res.status, txt)) {
      console.warn(`[meta] permission error ${ctx} ${res.status}:`, txt.slice(0, 500));
      throw new MetaPermissionError(ctx);
    }
    console.error(`[meta] error ${ctx} ${res.status}:`, txt.slice(0, 500));
    throw new Error(`${ctx} ${res.status}: ${txt.slice(0, 400)}`);
  }
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error(`${ctx}: nieprawidłowy JSON: ${txt.slice(0, 200)}`);
  }
}

// =============================================================================
// OAuth — wymiana code → user token → long-lived → pages + IG
// =============================================================================

export async function exchangeMetaCode(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const params = new URLSearchParams({
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    code: args.code,
  });
  const j = await graphJson<{ access_token: string; expires_in?: number }>(
    `${GRAPH}/oauth/access_token?${params.toString()}`,
    { context: "Meta token exchange" },
  );
  return { accessToken: j.access_token, expiresIn: j.expires_in ?? null };
}

export async function exchangeLongLivedUserToken(args: {
  shortToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: args.clientId,
    client_secret: args.clientSecret,
    fb_exchange_token: args.shortToken,
  });
  const j = await graphJson<{ access_token: string; expires_in?: number }>(
    `${GRAPH}/oauth/access_token?${params.toString()}`,
    { context: "Meta long-lived exchange" },
  );
  return { accessToken: j.access_token, expiresIn: j.expires_in ?? null };
}

export async function exchangeInstagramLoginCode(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; userId: string; scopes: string[] }> {
  const body = new URLSearchParams({
    client_id: args.clientId,
    client_secret: args.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
    code: args.code,
  });
  const j = await graphJson<{
    access_token?: string;
    user_id?: string;
    permissions?: string;
    data?: Array<{ access_token?: string; user_id?: string; permissions?: string }>;
  }>("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
    context: "Instagram token exchange",
  });
  const item = j.data?.[0] ?? j;
  if (!item.access_token || !item.user_id) {
    throw new Error("Instagram token exchange: brak access_token lub user_id.");
  }
  return {
    accessToken: item.access_token,
    userId: String(item.user_id),
    scopes: (item.permissions ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export async function exchangeLongLivedInstagramToken(args: {
  shortToken: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: args.clientSecret,
    access_token: args.shortToken,
  });
  const j = await graphJson<{ access_token: string; expires_in?: number }>(
    `https://graph.instagram.com/access_token?${params.toString()}`,
    { context: "Instagram long-lived exchange" },
  );
  return { accessToken: j.access_token, expiresIn: j.expires_in ?? null };
}

export async function fetchInstagramLoginProfile(accessToken: string): Promise<{ id: string; username: string }> {
  const j = await graphJson<{
    user_id?: string;
    username?: string;
    data?: Array<{ user_id?: string; username?: string }>;
  }>(`${INSTAGRAM_GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(accessToken)}`, {
    context: "Instagram /me",
  });
  const item = j.data?.[0] ?? j;
  if (!item.user_id || !item.username) throw new Error("Instagram /me: brak user_id lub username.");
  return { id: String(item.user_id), username: item.username };
}

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  picture?: string | null;
  business?: { id: string; name: string } | null;
  tasks?: string[];
  instagram?: {
    id: string;
    username: string;
    profile_picture_url?: string | null;
  } | null;
};

export async function listUserPages(userAccessToken: string): Promise<MetaPage[]> {
  const url =
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture{url},tasks,business{id,name},` +
    `instagram_business_account{id,username,profile_picture_url}&limit=100`;
  const j = await graphJson<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      tasks?: string[];
      business?: { id: string; name: string };
      instagram_business_account?: {
        id: string;
        username: string;
        profile_picture_url?: string;
      };
    }>;
  }>(`${url}&access_token=${encodeURIComponent(userAccessToken)}`, {
    context: "Meta /me/accounts",
  });
  console.log("[meta] /me/accounts pages count =", (j.data ?? []).length);
  return (j.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
    picture: p.picture?.data?.url ?? null,
    business: p.business ? { id: p.business.id, name: p.business.name } : null,
    tasks: p.tasks ?? [],
    instagram: p.instagram_business_account
      ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          profile_picture_url:
            p.instagram_business_account.profile_picture_url ?? null,
        }
      : null,
  }));
}

/** Diagnostyka: lista uprawnień (granted/declined) dla user tokena. */
export async function listUserPermissions(
  userAccessToken: string,
): Promise<{ granted: string[]; declined: string[] }> {
  try {
    const j = await graphJson<{
      data: Array<{ permission: string; status: "granted" | "declined" }>;
    }>(
      `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userAccessToken)}`,
      { context: "Meta /me/permissions" },
    );
    const granted: string[] = [];
    const declined: string[] = [];
    for (const it of j.data ?? []) {
      if (it.status === "granted") granted.push(it.permission);
      else declined.push(it.permission);
    }
    return { granted, declined };
  } catch (e) {
    console.warn("[meta] /me/permissions failed:", e);
    return { granted: [], declined: [] };
  }
}

// =============================================================================
// Facebook adapter
// =============================================================================

export const facebookAdapter: PlatformAdapter = {
  platformId: "facebook",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const text = composeText(content, 60000);
    const pageId = account.external_account_id;
    const token = account.access_token;
    const media = (content.media_urls ?? []).slice(0, 10);

    let postId: string;

    if (media.length === 0) {
      // Tekst-only
      const params = new URLSearchParams({
        message: text,
        access_token: token,
      });
      const j = await graphJson<{ id: string }>(
        `${GRAPH}/${encodeURIComponent(pageId)}/feed`,
        { method: "POST", body: params, context: "FB /feed" },
      );
      postId = j.id;
    } else if (media.length === 1) {
      // Pojedynczy obrazek
      const params = new URLSearchParams({
        url: media[0],
        caption: text,
        access_token: token,
      });
      const j = await graphJson<{ id: string; post_id?: string }>(
        `${GRAPH}/${encodeURIComponent(pageId)}/photos`,
        { method: "POST", body: params, context: "FB /photos" },
      );
      postId = j.post_id ?? j.id;
    } else {
      // Galeria: upload każdego published=false, potem feed z attached_media
      const mediaIds: string[] = [];
      for (const url of media) {
        const p = new URLSearchParams({
          url,
          published: "false",
          access_token: token,
        });
        const j = await graphJson<{ id: string }>(
          `${GRAPH}/${encodeURIComponent(pageId)}/photos`,
          { method: "POST", body: p, context: "FB /photos (unpublished)" },
        );
        mediaIds.push(j.id);
      }
      const attached = mediaIds.map((id) => ({ media_fbid: id }));
      const params = new URLSearchParams({
        message: text,
        attached_media: JSON.stringify(attached),
        access_token: token,
      });
      const j = await graphJson<{ id: string }>(
        `${GRAPH}/${encodeURIComponent(pageId)}/feed`,
        { method: "POST", body: params, context: "FB /feed gallery" },
      );
      postId = j.id;
    }

    const permalink = `https://www.facebook.com/${postId}`;
    return { externalPostId: postId, externalUrl: permalink };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    const params = new URLSearchParams({
      fields: "likes.limit(0).summary(true),comments.limit(0).summary(true),shares",
      access_token: account.access_token,
    });
    const url = `${GRAPH}/${encodeURIComponent(externalPostId)}?${params.toString()}`;
    let j: {
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    };
    try {
      j = await graphJson<{
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }>(url, { context: "FB metrics" });
    } catch (e) {
      if (e instanceof MetaPermissionError) throw e;
      const [likes, comments] = await Promise.all([
        fetchFbEdgeSummaryCount({
          objectId: externalPostId,
          edge: "likes",
          accessToken: account.access_token,
          context: "FB /likes summary",
        }),
        fetchFbEdgeSummaryCount({
          objectId: externalPostId,
          edge: "comments",
          accessToken: account.access_token,
          context: "FB /comments summary",
        }),
      ]);
      j = {
        likes: { summary: { total_count: likes } },
        comments: { summary: { total_count: comments } },
      };
    }
    return {
      likes: j.likes?.summary?.total_count ?? 0,
      comments: j.comments?.summary?.total_count ?? 0,
      shares: j.shares?.count ?? 0,
      views: 0,
      raw: j as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId, sinceIso }): Promise<PlatformInboxItem[]> {
    // Pola komentarzy z Page tokena. Nie pobieramy avatarów autorów, bo częściej
    // uruchamiają dodatkowe ograniczenia API niż same komentarze i liczniki.
    const params = new URLSearchParams({
      fields: "id,from{name,id,picture{url}},message,created_time,like_count,comment_count,permalink_url,parent{id}",
      filter: "stream",
      order: "reverse_chronological",
      limit: "100",
      access_token: account.access_token,
    });
    type FbComment = {
      id: string;
      from?: { id?: string; name?: string; picture?: { data?: { url?: string } } };
      message?: string;
      created_time: string;
      like_count?: number;
      comment_count?: number;
      permalink_url?: string;
      parent?: { id?: string };
    };
    const mapComment = (c: FbComment): PlatformInboxItem => ({
      externalCommentId: c.id,
      externalParentCommentId: c.parent?.id && c.parent.id !== externalPostId ? c.parent.id : null,
      externalPostId,
      authorExternalId: c.from?.id ?? null,
      authorName: c.from?.name ?? null,
      authorAvatarUrl: c.from?.picture?.data?.url ?? null,
      content: c.message ?? "",
      permalink: c.permalink_url ?? `https://www.facebook.com/${c.id}`,
      postedAt: c.created_time,
      likeCount: c.like_count ?? 0,
      replyCount: c.comment_count ?? 0,
    });

    try {
      const j = await graphJson<{
        data: FbComment[];
      }>(
        `${GRAPH}/${encodeURIComponent(externalPostId)}/comments?${params.toString()}`,
        { context: "FB /comments" },
      );
      const out = new Map<string, PlatformInboxItem>();
      const roots = (j.data ?? []).map(mapComment);
      for (const item of roots) out.set(item.externalCommentId, item);
      const rootsWithReplies = roots.filter((item) => !item.externalParentCommentId && (item.replyCount ?? 0) > 0);
      await Promise.all(
        rootsWithReplies.slice(0, 25).map(async (root) => {
          try {
            const rp = new URLSearchParams({
              fields: "id,from{name,id,picture{url}},message,created_time,like_count,comment_count,permalink_url,parent{id}",
              limit: "50",
              access_token: account.access_token,
            });
            const replies = await graphJson<{ data?: FbComment[] }>(
              `${GRAPH}/${encodeURIComponent(root.externalCommentId)}/comments?${rp.toString()}`,
              { context: "FB comment replies" },
            );
            for (const reply of replies.data ?? []) out.set(reply.id, mapComment(reply));
          } catch (e) {
            console.warn("[meta] FB comment replies failed:", e instanceof Error ? e.message : e);
          }
        }),
      );
      const sinceTs = sinceIso ? new Date(sinceIso).getTime() : null;
      return Array.from(out.values()).filter((c) => !sinceTs || !c.postedAt || new Date(c.postedAt).getTime() > sinceTs);
    } catch (e) {
      if (e instanceof MetaPermissionError) throw e;
      console.warn("[meta] FB /comments edge failed, trying nested comments:", e);
    }

    const nestedParams = new URLSearchParams({
      fields:
        "comments.order(reverse_chronological).limit(50){id,from{name,id},message,created_time,like_count,comment_count,permalink_url,parent{id}}",
      access_token: account.access_token,
    });
    const nested = await graphJson<{
      comments?: { data?: FbComment[] };
    }>(`${GRAPH}/${encodeURIComponent(externalPostId)}?${nestedParams.toString()}`, {
      context: "FB nested comments",
    });
    const sinceTs = sinceIso ? new Date(sinceIso).getTime() : null;
    return (nested.comments?.data ?? [])
      .filter((c) => !sinceTs || new Date(c.created_time).getTime() > sinceTs)
      .map(mapComment);
  },

  async reply({ account, externalParentCommentId, text }): Promise<PlatformReplyResult> {
    const params = new URLSearchParams({
      message: text.slice(0, 8000),
      access_token: account.access_token,
    });
    const j = await graphJson<{ id: string }>(
      `${GRAPH}/${encodeURIComponent(externalParentCommentId)}/comments`,
      { method: "POST", body: params, context: "FB reply" },
    );
    return { externalCommentId: j.id };
  },

  async moderateComment({ account, externalCommentId, action }): Promise<{ ok: boolean }> {
    const params = new URLSearchParams({ access_token: account.access_token });
    if (action === "hide" || action === "unhide") {
      params.set("is_hidden", action === "hide" ? "true" : "false");
    }
    await graphJson<{ success?: boolean }>(
      `${GRAPH}/${encodeURIComponent(externalCommentId)}?${params.toString()}`,
      {
        method: action === "delete" ? "DELETE" : "POST",
        context: `FB comment ${action}`,
      },
    );
    return { ok: true };
  },

  async like({ account, externalId }): Promise<{ ok: boolean }> {
    const params = new URLSearchParams({
      access_token: account.access_token,
    });
    await graphJson<{ success?: boolean }>(
      `${GRAPH}/${encodeURIComponent(externalId)}/likes`,
      { method: "POST", body: params, context: "FB like" },
    );
    return { ok: true };
  },

  async listRecentPosts({ account, limit }): Promise<PlatformRecentPost[]> {
    const pageId = account.external_account_id;
    const token = account.access_token;
    const safeLimit = Math.min(Math.max(limit, 1), 25);

    // Nie pobieramy pól agregowanych/deprecated w /posts (attachments, object_id,
    // source, type itd.) — Meta zwraca OAuthException #12:
    // deprecate_post_aggregated_fields_for_attachment. Grafiki bierzemy tylko
    // z pól nadal wspieranych na liście postów: full_picture/picture.
    const postFields = "id,message,story,created_time,permalink_url,full_picture,picture";

    type PostRow = {
      id: string;
      message?: string;
      story?: string;
      created_time: string;
      permalink_url?: string;
      full_picture?: string;
      picture?: string;
    };

    const fetchWith = async (fields: string, lim: number) => {
      const params = new URLSearchParams({
        fields,
        limit: String(lim),
        access_token: token,
      });
      return graphJson<{ data: PostRow[] }>(
        `${GRAPH}/${encodeURIComponent(pageId)}/posts?${params.toString()}`,
        { context: "FB /posts (list)" },
      );
    };

    let j: { data: PostRow[] };
    try {
      j = await fetchWith(postFields, safeLimit);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // "reduce the amount of data" / code:1 albo Meta #12 dla pól deprecated
      // → retry z minimalnym zestawem i mniejszym limitem.
      if (/reduce the amount of data|"code":1\b|deprecate_post_aggregated_fields_for_attachment|"code":12\b/i.test(msg)) {
        try {
          j = await fetchWith("id,message,story,created_time,permalink_url,full_picture,picture", Math.min(safeLimit, 10));
        } catch {
          // ostatnia próba: tylko ID + timestamp, limit 5
          j = await fetchWith("id,message,created_time,permalink_url", 5);
        }
      } else {
        throw e;
      }
    }

    return Promise.all((j.data ?? []).map(async (p) => {
      const mediaUrls = collectFbMediaUrls(p);
      const mediaItems = await fetchFbPostMediaItems(p.id, token).catch(() => null);
      const itemsFallback: Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> =
        mediaItems && mediaItems.length > 0
          ? mediaItems
          : mediaUrls.map((url) => ({ url, type: "image" as const, thumbnail_url: null }));
      return {
        externalPostId: p.id,
        externalUrl: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
        text: p.message ?? p.story ?? "",
        mediaUrls: itemsFallback.map((i) => i.thumbnail_url ?? i.url),
        mediaItems: itemsFallback,
        postedAt: p.created_time,
      };
    }));
  },
};

/**
 * Pobiera attachments dla pojedynczego posta FB (per-object endpoint nie wpada
 * w aggregated #12 tak często jak /posts?fields=attachments). Wyciąga zarówno
 * obrazy jak i wideo (typy: photo, video, video_inline, share, album).
 * Zwraca null w razie błędu uprawnień.
 */
export async function fetchFbPostMediaItems(
  postId: string,
  accessToken: string,
): Promise<Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> | null> {
  try {
    const fields =
      "attachments{media_type,type,media,target,url,subattachments{media_type,type,media,target,url}}";
    const url = `${GRAPH}/${encodeURIComponent(postId)}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
    type Att = {
      media_type?: string;
      type?: string;
      url?: string;
      target?: { id?: string; url?: string };
      media?: {
        image?: { src?: string };
        source?: string;
      };
      subattachments?: { data?: Att[] };
    };
    const j = await graphJson<{ attachments?: { data?: Att[] } }>(url, {
      context: "FB post attachments",
    });
    const items: Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> = [];
    const walk = (atts: Att[]) => {
      for (const a of atts) {
        const t = (a.media_type ?? a.type ?? "").toLowerCase();
        const img = a.media?.image?.src ?? null;
        const src = a.media?.source ?? null;
        if (t.includes("video") || t === "animated_image_video") {
          const videoUrl = src ?? img;
          if (videoUrl) items.push({ url: videoUrl, type: "video", thumbnail_url: img });
        } else if (img) {
          items.push({ url: img, type: "image" });
        }
        if (a.subattachments?.data?.length) walk(a.subattachments.data);
      }
    };
    walk(j.attachments?.data ?? []);
    return items;
  } catch (e) {
    console.warn("[meta] fetchFbPostMediaItems failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// =============================================================================
// Instagram adapter (Business / Creator)
// =============================================================================

async function waitForIgContainer(args: {
  containerId: string;
  accessToken: string;
  apiBase: string;
}): Promise<void> {
  // Container musi być FINISHED zanim publish. Próbujemy do 10s.
  for (let i = 0; i < 10; i++) {
    const j = await graphJson<{ status_code?: string }>(
      `${args.apiBase}/${args.containerId}?fields=status_code&access_token=${encodeURIComponent(args.accessToken)}`,
      { context: "IG container status" },
    );
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") {
      throw new Error(`IG container status=${j.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export const instagramAdapter: PlatformAdapter = {
  platformId: "instagram",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const igId = account.external_account_id;
    const token = account.access_token;
    const apiBase = isInstagramLoginAccount(account) ? INSTAGRAM_GRAPH : GRAPH;
    const caption = composeText(content, 2200);
    const media = (content.media_urls ?? []).filter(Boolean);
    if (media.length === 0) {
      throw new Error(
        "Instagram wymaga co najmniej jednego obrazka — publikacja samego tekstu nie jest wspierana.",
      );
    }

    let creationId: string;

    if (media.length === 1) {
      const params = new URLSearchParams({
        image_url: media[0],
        caption,
        access_token: token,
      });
      const j = await graphJson<{ id: string }>(
        `${apiBase}/${encodeURIComponent(igId)}/media`,
        { method: "POST", body: params, context: "IG /media (single)" },
      );
      creationId = j.id;
    } else {
      // Carousel: każdy child osobno (is_carousel_item=true), potem CAROUSEL
      const childIds: string[] = [];
      for (const url of media.slice(0, 10)) {
        const p = new URLSearchParams({
          image_url: url,
          is_carousel_item: "true",
          access_token: token,
        });
        const j = await graphJson<{ id: string }>(
          `${apiBase}/${encodeURIComponent(igId)}/media`,
          { method: "POST", body: p, context: "IG carousel child" },
        );
        childIds.push(j.id);
      }
      const p = new URLSearchParams({
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
        access_token: token,
      });
      const j = await graphJson<{ id: string }>(
        `${apiBase}/${encodeURIComponent(igId)}/media`,
        { method: "POST", body: p, context: "IG carousel parent" },
      );
      creationId = j.id;
    }

    await waitForIgContainer({ containerId: creationId, accessToken: token, apiBase });

    const pub = new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    });
    const pubRes = await graphJson<{ id: string }>(
      `${apiBase}/${encodeURIComponent(igId)}/media_publish`,
      { method: "POST", body: pub, context: "IG /media_publish" },
    );
    const mediaId = pubRes.id;

    // Pobierz permalink
    let permalink: string | null = null;
    try {
      const meta = await graphJson<{ permalink?: string }>(
        `${apiBase}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
        { context: "IG permalink" },
      );
      permalink = meta.permalink ?? null;
    } catch {
      permalink = null;
    }
    return { externalPostId: mediaId, externalUrl: permalink };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    const apiBase = isInstagramLoginAccount(account) ? INSTAGRAM_GRAPH : GRAPH;
    // Najpierw policzniki na obiekcie media
    const baseUrl =
      `${apiBase}/${encodeURIComponent(externalPostId)}` +
      `?fields=like_count,comments_count,media_product_type,media_type` +
      `&access_token=${encodeURIComponent(account.access_token)}`;
    const base = await graphJson<{
      like_count?: number;
      comments_count?: number;
      media_product_type?: string;
      media_type?: string;
    }>(baseUrl, { context: "IG media" });

    // Insights — pakiet metryk zależy od typu mediów; bezpieczny wspólny:
    let views = 0;
    try {
      const ins = await graphJson<{
        data?: Array<{ name: string; values?: Array<{ value: number }> }>;
      }>(
        `${apiBase}/${encodeURIComponent(externalPostId)}/insights?metric=reach&access_token=${encodeURIComponent(account.access_token)}`,
        { context: "IG insights" },
      );
      views = ins.data?.find((d) => d.name === "reach")?.values?.[0]?.value ?? 0;
    } catch {
      views = 0;
    }
    return {
      likes: base.like_count ?? 0,
      comments: base.comments_count ?? 0,
      shares: 0,
      views,
      raw: base as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId, sinceIso }): Promise<PlatformInboxItem[]> {
    const params = new URLSearchParams({
      fields: "id,username,text,timestamp,like_count,replies{id}",
      limit: "100",
      access_token: account.access_token,
    });
    type IgComment = {
      id: string;
      username?: string;
      text?: string;
      timestamp: string;
      like_count?: number;
      replies?: { data?: Array<{ id: string }> };
    };
    type IgReply = {
      id: string;
      username?: string;
      text?: string;
      timestamp?: string;
      like_count?: number;
    };
    let items: IgComment[] = [];
    let lastError: unknown = null;
    for (const base of igApiBases(account)) {
      try {
        const j = await graphJson<{ data?: IgComment[] }>(
          `${base}/${encodeURIComponent(externalPostId)}/comments?${params.toString()}`,
          { context: base === INSTAGRAM_GRAPH ? "IG /comments (Instagram API)" : "IG /comments" },
        );
        items = j.data ?? [];
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (items.length === 0 && lastError) {
      throw lastError instanceof Error ? lastError : new Error("IG /comments: nie udało się pobrać komentarzy.");
    }
    const out: PlatformInboxItem[] = [];
    const sinceTs = sinceIso ? new Date(sinceIso).getTime() : null;
    const pushRoot = (c: IgComment) => out.push({
        externalCommentId: c.id,
        externalParentCommentId: null,
        externalPostId,
        authorExternalId: null,
        authorName: c.username ?? null,
        authorAvatarUrl: null,
        content: c.text ?? "",
        permalink: null,
        postedAt: c.timestamp,
        likeCount: c.like_count ?? 0,
        replyCount: c.replies?.data?.length ?? 0,
      });
    const pushReply = (parentId: string, r: IgReply) => out.push({
      externalCommentId: r.id,
      externalParentCommentId: parentId,
      externalPostId,
      authorExternalId: null,
      authorName: r.username ?? null,
      authorAvatarUrl: null,
      content: r.text ?? "",
      permalink: null,
      postedAt: r.timestamp ?? null,
      likeCount: r.like_count ?? 0,
      replyCount: 0,
    });

    for (const c of items) pushRoot(c);
    await Promise.all(
      items
        .filter((c) => (c.replies?.data?.length ?? 0) > 0)
        .slice(0, 50)
        .map(async (c) => {
          const rp = new URLSearchParams({
            fields: "id,username,text,timestamp,like_count",
            limit: "50",
            access_token: account.access_token,
          });
          for (const base of igApiBases(account)) {
            try {
              const replies = await graphJson<{ data?: IgReply[] }>(
                `${base}/${encodeURIComponent(c.id)}/replies?${rp.toString()}`,
                { context: base === INSTAGRAM_GRAPH ? "IG /replies (Instagram API)" : "IG /replies" },
              );
              for (const reply of replies.data ?? []) pushReply(c.id, reply);
              return;
            } catch (e) {
              lastError = e;
            }
          }
          console.warn("[meta] IG /replies failed:", lastError instanceof Error ? lastError.message : lastError);
        }),
    );
    return out.filter((c) => !sinceTs || !c.postedAt || new Date(c.postedAt).getTime() > sinceTs);
  },

  async reply({ account, externalParentCommentId, text }): Promise<PlatformReplyResult> {
    const scopes = account.scopes ?? [];
    const usesInstagramLogin = isInstagramLoginAccount(account);
    const hasInstagramLoginScopes = scopes.some((s) => s.startsWith("instagram_business_"));
    if (!usesInstagramLogin && hasInstagramLoginScopes) {
      throw new Error(
        "Konto Instagram ma zapisany nieprawidłowy typ tokena po ostatnim połączeniu przez Facebook. " +
          "Rozłącz Instagram i połącz go ponownie przyciskiem „Połącz z Instagram”, a nie przez Facebook.",
      );
    }
    const requiredScope = usesInstagramLogin ? "instagram_business_manage_comments" : "instagram_manage_comments";
    const hasKnownCommentScope = scopes.includes(requiredScope);
    if (scopes.length > 0 && !hasKnownCommentScope) {
      if (!usesInstagramLogin) {
        throw new Error(explainMetaCommentPermissionError(account, "IG reply"));
      } else {
        throw new Error(
          `Brak uprawnienia do zarządzania komentarzami Instagram. Aktualne scope'y: [${scopes.join(", ")}]. ` +
            `Rozłącz i połącz Instagram ponownie, akceptując uprawnienie ${requiredScope}.`,
        );
      }
    }
    const endpoints = igApiBases(account);
    const message = text.slice(0, 2200);
    const attempts: string[] = [];
    let j: { id: string } | null = null;
    for (const base of endpoints) {
      const isIgApi = base === INSTAGRAM_GRAPH;
      // graph.instagram.com wymaga Instagram User tokena, graph.facebook.com wymaga Page tokena.
      const params = new URLSearchParams({ message });
      if (!isIgApi) params.set("access_token", account.access_token);
      try {
        j = await graphJson<{ id: string }>(
          `${base}/${encodeURIComponent(externalParentCommentId)}/replies`,
          {
            method: "POST",
            body: params,
            headers: isIgApi ? { Authorization: `Bearer ${account.access_token}` } : undefined,
            context: isIgApi ? "IG reply (Instagram API)" : "IG reply",
          },
        );
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${isIgApi ? "graph.instagram.com" : "graph.facebook.com"}: ${msg}`);
      }
    }
    if (!j) {
      if (attempts.some(isMetaMissingPermissionError)) {
        throw new Error(explainMetaCommentPermissionError(account, "IG reply"));
      }
      throw new Error(
        `IG reply: nie udało się wysłać odpowiedzi.\nScope'y konta: [${scopes.join(", ")}]\n` +
          attempts.map((a) => `• ${a}`).join("\n"),
      );
    }
    return { externalCommentId: j.id };
  },

  async moderateComment({ account, externalCommentId, action }): Promise<{ ok: boolean }> {
    const params = new URLSearchParams();
    const attempts: string[] = [];
    if (action === "hide" || action === "unhide") {
      params.set("hide", action === "hide" ? "true" : "false");
    }
    for (const base of igApiBases(account)) {
      const isIgApi = base === INSTAGRAM_GRAPH;
      params.set("access_token", account.access_token);
      const query = params.toString();
      const url = `${base}/${encodeURIComponent(externalCommentId)}${query ? `?${query}` : ""}`;
      try {
        await graphJson<{ success?: boolean }>(
          url,
          {
            method: action === "delete" ? "DELETE" : "POST",
            body: undefined,
            headers: isIgApi ? { Authorization: `Bearer ${account.access_token}` } : undefined,
            context: isIgApi ? `IG comment ${action} (Instagram API)` : `IG comment ${action}`,
          },
        );
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push(`${isIgApi ? "graph.instagram.com" : "graph.facebook.com"}: ${msg}`);
      }
    }
    if (attempts.some(isMetaMissingPermissionError)) {
      throw new Error(explainMetaCommentPermissionError(account, `IG comment ${action}`));
    }
    throw new Error(
      `IG comment ${action}: nie udało się wykonać operacji.\n` +
        attempts.map((a) => `• ${a}`).join("\n"),
    );
  },

  async like({ account, target, externalId }): Promise<{ ok: boolean }> {
    const params = new URLSearchParams({
      access_token: account.access_token,
      [target === "comment" ? "comment_id" : "media_id"]: externalId,
    });
    let lastError: unknown = null;
    for (const base of [GRAPH, INSTAGRAM_GRAPH]) {
      try {
        await graphJson<{ success?: boolean }>(
          `${base}/${encodeURIComponent(account.external_account_id)}/likes`,
          { method: "POST", body: params, context: base === INSTAGRAM_GRAPH ? "IG like (Instagram API)" : "IG like" },
        );
        return { ok: true };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("IG like: nie udało się polubić.");
  },

  async listRecentPosts({ account, limit }): Promise<PlatformRecentPost[]> {
    const igId = account.external_account_id;
    const token = account.access_token;
    const apiBase = isInstagramLoginAccount(account) ? INSTAGRAM_GRAPH : GRAPH;
    const params = new URLSearchParams({
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,thumbnail_url,media_type}",
      limit: String(Math.min(Math.max(limit, 1), 100)),
      access_token: token,
    });
    const j = await graphJson<{
      data: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        timestamp: string;
        children?: {
          data?: Array<{
            media_url?: string;
            thumbnail_url?: string;
            media_type?: string;
          }>;
        };
      }>;
    }>(
      `${apiBase}/${encodeURIComponent(igId)}/media?${params.toString()}`,
      { context: "IG /media (list)" },
    );
    return (j.data ?? []).map((m) => {
      const mediaUrls: string[] = [];
      const mediaItems: Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> = [];
      const children = m.children?.data ?? [];
      const pushOne = (it: { mediaType?: string; mediaUrl?: string; thumbnailUrl?: string }) => {
        const url = pickIgDisplayMediaUrl(it);
        if (url) mediaUrls.push(url);
        const item = pickIgMediaItem(it);
        if (item) mediaItems.push(item);
      };
      if (children.length > 0) {
        for (const c of children) {
          pushOne({ mediaType: c.media_type, mediaUrl: c.media_url, thumbnailUrl: c.thumbnail_url });
        }
      } else {
        pushOne({ mediaType: m.media_type, mediaUrl: m.media_url, thumbnailUrl: m.thumbnail_url });
      }
      return {
        externalPostId: m.id,
        externalUrl: m.permalink ?? null,
        text: m.caption ?? "",
        mediaUrls,
        mediaItems,
        postedAt: m.timestamp,
      };
    });
  },
};

/**
 * Pobiera świeże URL-e mediów dla pojedynczego posta IG / FB.
 * IG CDN URL-e wygasają po ~24h, więc przy synchronizacji musimy je odświeżać.
 * Zwraca null gdy nie udało się pobrać (np. post usunięty / brak uprawnień).
 */
export async function refreshIgPostMediaUrls(args: {
  externalPostId: string;
  accessToken: string;
}): Promise<string[] | null> {
  const items = await refreshIgPostMediaItems(args);
  return items ? items.map((i) => i.type === "video" ? i.thumbnail_url ?? i.url : i.url) : null;
}

export async function refreshIgPostMediaItems(args: {
  externalPostId: string;
  accessToken: string;
}): Promise<Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> | null> {
  try {
    const fields =
      "id,media_type,media_url,thumbnail_url,children{media_url,thumbnail_url,media_type}";
    const url = `${GRAPH}/${encodeURIComponent(args.externalPostId)}?fields=${fields}&access_token=${encodeURIComponent(args.accessToken)}`;
    const j = await graphJson<{
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      children?: {
        data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }>;
      };
    }>(url, { context: "IG media refresh" });
    const items: Array<{ url: string; type: "image" | "video"; thumbnail_url?: string | null }> = [];
    const children = j.children?.data ?? [];
    if (children.length > 0) {
      for (const c of children) {
        const item = pickIgMediaItem({
          mediaType: c.media_type,
          mediaUrl: c.media_url,
          thumbnailUrl: c.thumbnail_url,
        });
        if (item) items.push(item);
      }
    } else {
      const item = pickIgMediaItem({
        mediaType: j.media_type,
        mediaUrl: j.media_url,
        thumbnailUrl: j.thumbnail_url,
      });
      if (item) items.push(item);
    }
    return items;
  } catch (e) {
    console.warn("[meta] refreshIgPostMediaItems failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function refreshFbPostMediaUrls(args: {
  externalPostId: string;
  accessToken: string;
}): Promise<string[] | null> {
  try {
    // Pola attachments/object_id/source/type itd. są deprecated dla postów stron
    // i potrafią zwracać Meta #12. Do odświeżania mediów używamy tylko pól
    // wspieranych w aktualnym Graph API.
    const fields = "id,full_picture,picture";
    const url = `${GRAPH}/${encodeURIComponent(args.externalPostId)}?fields=${fields}&access_token=${encodeURIComponent(args.accessToken)}`;
    const j = await graphJson<FbPostMediaShape>(url, { context: "FB media refresh" });
    return collectFbMediaUrls(j);
  } catch (e) {
    console.warn("[meta] refreshFbPostMediaUrls failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
