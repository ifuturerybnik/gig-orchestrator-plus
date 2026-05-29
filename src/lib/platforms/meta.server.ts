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
  PlatformReplyResult,
} from "./types";

const GRAPH = "https://graph.facebook.com/v20.0";

function composeText(content: PlatformPostContent, maxLen: number): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join("\n\n");
  if (out.length > maxLen) return out.slice(0, maxLen - 3) + "…";
  return out;
}

async function graphJson<T = unknown>(
  url: string,
  init?: RequestInit & { context?: string },
): Promise<T> {
  const ctx = init?.context ?? "Meta API";
  const res = await fetch(url, init);
  const txt = await res.text();
  if (!res.ok) {
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

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  picture?: string | null;
  instagram?: {
    id: string;
    username: string;
    profile_picture_url?: string | null;
  } | null;
};

export async function listUserPages(userAccessToken: string): Promise<MetaPage[]> {
  const url =
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture{url},` +
    `instagram_business_account{id,username,profile_picture_url}&limit=100`;
  const j = await graphJson<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
      instagram_business_account?: {
        id: string;
        username: string;
        profile_picture_url?: string;
      };
    }>;
  }>(`${url}&access_token=${encodeURIComponent(userAccessToken)}`, {
    context: "Meta /me/accounts",
  });
  return (j.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
    picture: p.picture?.data?.url ?? null,
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
    const fields =
      "likes.summary(true),comments.summary(true),shares,reactions.summary(true)";
    const url =
      `${GRAPH}/${encodeURIComponent(externalPostId)}` +
      `?fields=${fields}&access_token=${encodeURIComponent(account.access_token)}`;
    const j = await graphJson<{
      likes?: { summary?: { total_count?: number } };
      reactions?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }>(url, { context: "FB metrics" });
    return {
      likes: j.reactions?.summary?.total_count ?? j.likes?.summary?.total_count ?? 0,
      comments: j.comments?.summary?.total_count ?? 0,
      shares: j.shares?.count ?? 0,
      views: 0,
      raw: j as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId, sinceIso }): Promise<PlatformInboxItem[]> {
    const params = new URLSearchParams({
      fields:
        "id,from{id,name,picture},message,created_time,like_count,comment_count,parent",
      order: "reverse_chronological",
      limit: "50",
      access_token: account.access_token,
    });
    if (sinceIso) {
      params.set("since", String(Math.floor(new Date(sinceIso).getTime() / 1000)));
    }
    const j = await graphJson<{
      data: Array<{
        id: string;
        from?: { id: string; name: string; picture?: { data?: { url?: string } } };
        message?: string;
        created_time: string;
        like_count?: number;
        comment_count?: number;
        parent?: { id: string };
      }>;
    }>(
      `${GRAPH}/${encodeURIComponent(externalPostId)}/comments?${params.toString()}`,
      { context: "FB /comments" },
    );
    return (j.data ?? []).map((c) => ({
      externalCommentId: c.id,
      externalParentCommentId: c.parent?.id ?? null,
      externalPostId,
      authorExternalId: c.from?.id ?? null,
      authorName: c.from?.name ?? null,
      authorAvatarUrl: c.from?.picture?.data?.url ?? null,
      content: c.message ?? "",
      permalink: `https://www.facebook.com/${c.id}`,
      postedAt: c.created_time,
      likeCount: c.like_count ?? 0,
      replyCount: c.comment_count ?? 0,
    }));
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
};

// =============================================================================
// Instagram adapter (Business / Creator)
// =============================================================================

async function waitForIgContainer(args: {
  containerId: string;
  accessToken: string;
}): Promise<void> {
  // Container musi być FINISHED zanim publish. Próbujemy do 10s.
  for (let i = 0; i < 10; i++) {
    const j = await graphJson<{ status_code?: string }>(
      `${GRAPH}/${args.containerId}?fields=status_code&access_token=${encodeURIComponent(args.accessToken)}`,
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
        `${GRAPH}/${encodeURIComponent(igId)}/media`,
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
          `${GRAPH}/${encodeURIComponent(igId)}/media`,
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
        `${GRAPH}/${encodeURIComponent(igId)}/media`,
        { method: "POST", body: p, context: "IG carousel parent" },
      );
      creationId = j.id;
    }

    await waitForIgContainer({ containerId: creationId, accessToken: token });

    const pub = new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    });
    const pubRes = await graphJson<{ id: string }>(
      `${GRAPH}/${encodeURIComponent(igId)}/media_publish`,
      { method: "POST", body: pub, context: "IG /media_publish" },
    );
    const mediaId = pubRes.id;

    // Pobierz permalink
    let permalink: string | null = null;
    try {
      const meta = await graphJson<{ permalink?: string }>(
        `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
        { context: "IG permalink" },
      );
      permalink = meta.permalink ?? null;
    } catch {
      permalink = null;
    }
    return { externalPostId: mediaId, externalUrl: permalink };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    // Najpierw policzniki na obiekcie media
    const baseUrl =
      `${GRAPH}/${encodeURIComponent(externalPostId)}` +
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
        `${GRAPH}/${encodeURIComponent(externalPostId)}/insights?metric=reach&access_token=${encodeURIComponent(account.access_token)}`,
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
      access_token: account.access_token,
    });
    const j = await graphJson<{
      data: Array<{
        id: string;
        username?: string;
        text?: string;
        timestamp: string;
        like_count?: number;
        replies?: { data?: Array<{ id: string }> };
      }>;
    }>(
      `${GRAPH}/${encodeURIComponent(externalPostId)}/comments?${params.toString()}`,
      { context: "IG /comments" },
    );
    const items = j.data ?? [];
    const sinceTs = sinceIso ? new Date(sinceIso).getTime() : null;
    return items
      .filter((c) => !sinceTs || new Date(c.timestamp).getTime() > sinceTs)
      .map((c) => ({
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
      }));
  },

  async reply({ account, externalParentCommentId, text }): Promise<PlatformReplyResult> {
    const params = new URLSearchParams({
      message: text.slice(0, 2200),
      access_token: account.access_token,
    });
    const j = await graphJson<{ id: string }>(
      `${GRAPH}/${encodeURIComponent(externalParentCommentId)}/replies`,
      { method: "POST", body: params, context: "IG reply" },
    );
    return { externalCommentId: j.id };
  },
};
