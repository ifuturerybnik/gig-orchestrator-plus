// SERVER-ONLY. Adapter X (Twitter) — publikacja, metryki, inbox, odpowiedzi.
// Używa OAuth 2.0 (PKCE). Tokeny w bazie szyfrowane AES-256-GCM.
//
// API:
//  - POST /2/tweets                       — publikacja
//  - GET  /2/tweets/:id?tweet.fields=...  — metryki
//  - GET  /2/tweets/search/recent         — komentarze (konwersacja)
//  - POST /2/users/:id/tweets (reply)     — odpowiedź na komentarz
//  - POST /1.1/media/upload.json          — upload mediów (v1.1 wciąż wymagany)
//
// Refresh tokenów: POST https://api.twitter.com/2/oauth2/token grant=refresh_token.

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPostContent,
  PlatformPublishResult,
  PlatformReplyResult,
} from "./types";

const TWITTER_API = "https://api.twitter.com";

// ---------------- helpery ----------------

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function composeTweetText(content: PlatformPostContent): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join("\n\n");
  if (out.length > 280) {
    // Twitter twardo nie pozwoli >280; ucinamy bezpiecznie.
    return out.slice(0, 277) + "…";
  }
  return out;
}

async function uploadMediaFromUrl(args: {
  accessToken: string;
  mediaUrl: string;
}): Promise<string> {
  // 1) pobierz plik
  const resFile = await fetch(args.mediaUrl);
  if (!resFile.ok) throw new Error(`Nie pobrano mediów (${args.mediaUrl}): HTTP ${resFile.status}`);
  const buf = Buffer.from(await resFile.arrayBuffer());
  const mime = resFile.headers.get("content-type") ?? "application/octet-stream";

  // 2) upload v1.1 (form-urlencoded base64 — najprostsza droga w edge runtime)
  //    Dla małych obrazków (<5MB) wystarczy `media_data` jednorazowo.
  const form = new URLSearchParams();
  form.set("media_category", mime.startsWith("video/") ? "tweet_video" : "tweet_image");
  form.set("media_data", buf.toString("base64"));

  const res = await fetch(`${TWITTER_API}/1.1/media/upload.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`X media upload ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { media_id_string?: string };
  if (!j.media_id_string) throw new Error("X media upload: brak media_id_string");
  return j.media_id_string;
}

// ---------------- adapter ----------------

export const twitterAdapter: PlatformAdapter = {
  platformId: "twitter",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const text = composeTweetText(content);
    const mediaIds: string[] = [];

    // Upload obrazków/filmów (max 4 obrazki / 1 wideo per tweet)
    if (content.media_urls?.length) {
      for (const url of content.media_urls.slice(0, 4)) {
        const id = await uploadMediaFromUrl({
          accessToken: account.access_token,
          mediaUrl: url,
        });
        mediaIds.push(id);
      }
    }

    const body: Record<string, unknown> = { text };
    if (mediaIds.length) body.media = { media_ids: mediaIds };

    const res = await fetch(`${TWITTER_API}/2/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`X publish ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as { data?: { id: string; text: string } };
    const id = j.data?.id;
    if (!id) throw new Error("X publish: brak tweet id w odpowiedzi");

    const handle = account.account_name.replace(/^@/, "");
    return {
      externalPostId: id,
      externalUrl: `https://twitter.com/${handle}/status/${id}`,
    };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    const url = `${TWITTER_API}/2/tweets/${encodeURIComponent(
      externalPostId,
    )}?tweet.fields=public_metrics`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`X metrics ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      data?: {
        public_metrics?: {
          like_count?: number;
          reply_count?: number;
          retweet_count?: number;
          quote_count?: number;
          impression_count?: number;
        };
      };
    };
    const m = j.data?.public_metrics ?? {};
    return {
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      views: m.impression_count ?? 0,
      raw: m as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId, sinceIso }): Promise<PlatformInboxItem[]> {
    // Szukamy odpowiedzi w konwersacji = tweet_id rodzica.
    const params = new URLSearchParams({
      query: `conversation_id:${externalPostId} -from:${account.external_account_id}`,
      max_results: "100",
      "tweet.fields": "created_at,author_id,public_metrics,in_reply_to_user_id",
      expansions: "author_id",
      "user.fields": "username,name,profile_image_url",
    });
    if (sinceIso) {
      // Twitter recent search wymaga ISO bez ms.
      params.set("start_time", sinceIso.replace(/\.\d+Z$/, "Z"));
    }
    const res = await fetch(
      `${TWITTER_API}/2/tweets/search/recent?${params.toString()}`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`X inbox ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        public_metrics?: { like_count?: number; reply_count?: number };
      }>;
      includes?: {
        users?: Array<{
          id: string;
          username: string;
          name: string;
          profile_image_url?: string;
        }>;
      };
    };
    const usersById = new Map<string, { username: string; name: string; profile_image_url?: string }>();
    for (const u of j.includes?.users ?? []) usersById.set(u.id, u);

    return (j.data ?? []).map((t): PlatformInboxItem => {
      const u = usersById.get(t.author_id);
      return {
        externalCommentId: t.id,
        externalParentCommentId: null,
        externalPostId,
        authorExternalId: t.author_id,
        authorName: u ? `@${u.username}` : null,
        authorAvatarUrl: u?.profile_image_url ?? null,
        content: t.text,
        permalink: u
          ? `https://twitter.com/${u.username}/status/${t.id}`
          : `https://twitter.com/i/web/status/${t.id}`,
        postedAt: t.created_at,
        likeCount: t.public_metrics?.like_count ?? 0,
        replyCount: t.public_metrics?.reply_count ?? 0,
      };
    });
  },

  async reply({
    account,
    externalParentCommentId,
    text,
  }): Promise<PlatformReplyResult> {
    const safe = text.length > 280 ? text.slice(0, 277) + "…" : text;
    const body = {
      text: safe,
      reply: { in_reply_to_tweet_id: externalParentCommentId },
    };
    const res = await fetch(`${TWITTER_API}/2/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`X reply ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as { data?: { id: string } };
    if (!j.data?.id) throw new Error("X reply: brak id w odpowiedzi");
    return { externalCommentId: j.data.id };
  },
};

// ---------------- refresh tokenów (używane przez central helper) ----------------

export async function refreshTwitterToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
}> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
    client_id: args.clientId,
  });
  const res = await fetch(`${TWITTER_API}/2/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(args.clientId, args.clientSecret)}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`X refresh ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? null,
    expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    scope: j.scope,
  };
}
