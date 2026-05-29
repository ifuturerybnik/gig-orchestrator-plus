// SERVER-ONLY. Adapter YouTube (Google OAuth 2.0 + Data API v3).
//
// Endpointy:
//  - POST https://oauth2.googleapis.com/token                   — code exchange + refresh
//  - GET  https://www.googleapis.com/youtube/v3/channels?mine=true
//  - POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
//  - GET  https://www.googleapis.com/youtube/v3/videos?id=...&part=statistics,snippet
//  - GET  https://www.googleapis.com/youtube/v3/commentThreads?videoId=...
//  - POST https://www.googleapis.com/youtube/v3/comments?part=snippet
//
// Wymaga scopes: youtube.upload, youtube.readonly, youtube.force-ssl
//
// UWAGA Workers: cały plik video jest ładowany do pamięci jako Buffer.
// Limit Cloudflare Worker ~128MB RAM → film >100MB nie zadziała na edge.
// To pierwsza wersja; w razie potrzeby przeniesiemy upload do worker'a po stronie VPS.

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPostContent,
  PlatformPublishResult,
  PlatformReplyResult,
} from "./types";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const YT_API = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";

function buildTitle(content: PlatformPostContent): string {
  const raw = (content.text ?? "").split("\n")[0].trim() || "Nowy film";
  return raw.length > 95 ? raw.slice(0, 95) + "…" : raw;
}

function buildDescription(content: PlatformPostContent): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join("\n\n");
  return out.length > 4900 ? out.slice(0, 4900) : out;
}

// =============================================================================
// OAuth — code → token / refresh / channel info
// =============================================================================

export async function exchangeGoogleCode(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    client_secret: args.clientSecret,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google token exchange ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? null,
    expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    scope: j.scope ?? "",
  };
}

export async function refreshGoogleToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
    client_id: args.clientId,
    client_secret: args.clientSecret,
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google refresh ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? args.refreshToken,
    expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  };
}

export async function fetchYouTubeChannel(accessToken: string): Promise<{
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
}> {
  const url = `${YT_API}/channels?part=snippet&mine=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`YouTube /channels ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet: { title: string; thumbnails?: { default?: { url?: string } } };
    }>;
  };
  const ch = j.items?.[0];
  if (!ch) throw new Error("Brak kanału YouTube na tym koncie Google.");
  return {
    channelId: ch.id,
    title: ch.snippet.title,
    thumbnailUrl: ch.snippet.thumbnails?.default?.url ?? null,
  };
}

// =============================================================================
// Adapter
// =============================================================================

export const youtubeAdapter: PlatformAdapter = {
  platformId: "youtube",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const videoUrl = (content.media_urls ?? []).find(Boolean);
    if (!videoUrl) {
      throw new Error("YouTube wymaga URL do pliku wideo w media_urls[0].");
    }

    // 1) pobierz wideo
    const vidRes = await fetch(videoUrl);
    if (!vidRes.ok) {
      throw new Error(`Pobranie pliku wideo nieudane: HTTP ${vidRes.status}`);
    }
    const contentType = vidRes.headers.get("content-type") ?? "video/*";
    const bytes = new Uint8Array(await vidRes.arrayBuffer());

    // 2) resumable session init
    const metadata = {
      snippet: {
        title: buildTitle(content),
        description: buildDescription(content),
        tags: (content.hashtags ?? []).slice(0, 30),
        categoryId: "10", // Music — domyślna kategoria; YT i tak pozwala zmienić.
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    };
    const initRes = await fetch(
      `${YT_UPLOAD}?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": String(bytes.byteLength),
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!initRes.ok) {
      const t = await initRes.text();
      throw new Error(`YouTube resumable init ${initRes.status}: ${t.slice(0, 300)}`);
    }
    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube: brak nagłówka Location w resumable init.");

    // 3) PUT bytes (single chunk — w razie potrzeby możemy chunkować)
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new Error(`YouTube upload PUT ${putRes.status}: ${t.slice(0, 300)}`);
    }
    const uploaded = (await putRes.json()) as { id?: string };
    const videoId = uploaded.id;
    if (!videoId) throw new Error("YouTube: brak id w odpowiedzi po upload.");

    return {
      externalPostId: videoId,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    const url = `${YT_API}/videos?part=statistics&id=${encodeURIComponent(externalPostId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`YouTube metrics ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      items?: Array<{
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
          favoriteCount?: string;
        };
      }>;
    };
    const s = j.items?.[0]?.statistics ?? {};
    return {
      likes: Number(s.likeCount ?? 0),
      comments: Number(s.commentCount ?? 0),
      shares: 0,
      views: Number(s.viewCount ?? 0),
      raw: s as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId, sinceIso }): Promise<PlatformInboxItem[]> {
    const url =
      `${YT_API}/commentThreads?part=snippet,replies&videoId=${encodeURIComponent(externalPostId)}` +
      `&maxResults=50&order=time&textFormat=plainText`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    if (!res.ok) {
      // 403 z reason=commentsDisabled — zwracamy pustą listę, nie błąd
      if (res.status === 403) return [];
      const t = await res.text();
      throw new Error(`YouTube commentThreads ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          topLevelComment: {
            id: string;
            snippet: {
              authorDisplayName?: string;
              authorChannelId?: { value?: string };
              authorProfileImageUrl?: string;
              textDisplay?: string;
              publishedAt?: string;
              likeCount?: number;
            };
          };
          totalReplyCount?: number;
        };
        replies?: {
          comments?: Array<{
            id: string;
            snippet: {
              authorDisplayName?: string;
              authorChannelId?: { value?: string };
              authorProfileImageUrl?: string;
              textDisplay?: string;
              publishedAt?: string;
              likeCount?: number;
              parentId?: string;
            };
          }>;
        };
      }>;
    };
    const sinceTs = sinceIso ? new Date(sinceIso).getTime() : null;
    const out: PlatformInboxItem[] = [];
    for (const t of j.items ?? []) {
      const top = t.snippet.topLevelComment;
      const ts = top.snippet.publishedAt ? new Date(top.snippet.publishedAt).getTime() : 0;
      if (!sinceTs || ts > sinceTs) {
        out.push({
          externalCommentId: top.id,
          externalParentCommentId: null,
          externalPostId,
          authorExternalId: top.snippet.authorChannelId?.value ?? null,
          authorName: top.snippet.authorDisplayName ?? null,
          authorAvatarUrl: top.snippet.authorProfileImageUrl ?? null,
          content: top.snippet.textDisplay ?? "",
          permalink: `https://www.youtube.com/watch?v=${externalPostId}&lc=${top.id}`,
          postedAt: top.snippet.publishedAt ?? null,
          likeCount: top.snippet.likeCount ?? 0,
          replyCount: t.snippet.totalReplyCount ?? 0,
        });
      }
      for (const r of t.replies?.comments ?? []) {
        const rts = r.snippet.publishedAt ? new Date(r.snippet.publishedAt).getTime() : 0;
        if (!sinceTs || rts > sinceTs) {
          out.push({
            externalCommentId: r.id,
            externalParentCommentId: r.snippet.parentId ?? top.id,
            externalPostId,
            authorExternalId: r.snippet.authorChannelId?.value ?? null,
            authorName: r.snippet.authorDisplayName ?? null,
            authorAvatarUrl: r.snippet.authorProfileImageUrl ?? null,
            content: r.snippet.textDisplay ?? "",
            permalink: `https://www.youtube.com/watch?v=${externalPostId}&lc=${r.id}`,
            postedAt: r.snippet.publishedAt ?? null,
            likeCount: r.snippet.likeCount ?? 0,
          });
        }
      }
    }
    return out;
  },

  async reply({ account, externalParentCommentId, text }): Promise<PlatformReplyResult> {
    const safe = text.length > 9500 ? text.slice(0, 9500) : text;
    const res = await fetch(`${YT_API}/comments?part=snippet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          parentId: externalParentCommentId,
          textOriginal: safe,
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`YouTube reply ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as { id?: string };
    if (!j.id) throw new Error("YouTube reply: brak id w odpowiedzi");
    return { externalCommentId: j.id };
  },
};

// =============================================================================
// Akceptowane PlatformAccount tylko po to, by TS nie krzyczał o unused import
// =============================================================================
export type _AccountUnused = PlatformAccount;
