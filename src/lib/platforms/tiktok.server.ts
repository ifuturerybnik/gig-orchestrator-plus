// SERVER-ONLY. Adapter TikTok (OAuth 2.0 + Content Posting API v2).
//
// Endpointy:
//  - POST https://open.tiktokapis.com/v2/oauth/token/                   — code exchange + refresh
//  - GET  https://open.tiktokapis.com/v2/user/info/                     — profil użytkownika
//  - POST https://open.tiktokapis.com/v2/post/publish/video/init/       — start publikacji (PULL_FROM_URL)
//  - POST https://open.tiktokapis.com/v2/post/publish/status/fetch/     — status publikacji
//  - POST https://open.tiktokapis.com/v2/video/list/                    — metryki posta
//
// UWAGA: TikTok nie udostępnia publicznego API do komentarzy (zwracamy []).
// reply() rzuca wyjątkiem — UI musi zablokować odpowiedź dla TT.
//
// UWAGA App Review: zanim aplikacja przejdzie audyt TT, publikacja kończy się
// w sandboksie statusem `SEND_TO_USER_INBOX` (film leci do skrzynki użytkownika
// i wymaga zatwierdzenia w aplikacji TikTok). Dla MVP to akceptowalne.

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPostContent,
  PlatformPublishResult,
  PlatformReplyResult,
} from "./types";

const TT_OAUTH = "https://open.tiktokapis.com/v2/oauth/token/";
const TT_API = "https://open.tiktokapis.com/v2";

function composeCaption(content: PlatformPostContent): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join(" ");
  // TikTok limit opisu ~2200 znaków
  return out.length > 2150 ? out.slice(0, 2150) + "…" : out;
}

// =============================================================================
// OAuth — code → token / refresh / user info
// =============================================================================

export async function exchangeTikTokCode(args: {
  code: string;
  redirectUri: string;
  clientKey: string;
  clientSecret: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
  openId: string;
}> {
  const body = new URLSearchParams({
    client_key: args.clientKey,
    client_secret: args.clientSecret,
    code: args.code,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
  });
  const res = await fetch(TT_OAUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TikTok token exchange ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    open_id: string;
    error?: string;
    error_description?: string;
  };
  if (j.error) {
    throw new Error(`TikTok token: ${j.error} — ${j.error_description ?? ""}`);
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? null,
    expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    scope: j.scope ?? "",
    openId: j.open_id,
  };
}

export async function refreshTikTokToken(args: {
  refreshToken: string;
  clientId: string; // = client_key (mapowanie z naszej kolumny client_id)
  clientSecret: string;
}): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }> {
  const body = new URLSearchParams({
    client_key: args.clientId,
    client_secret: args.clientSecret,
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  const res = await fetch(TT_OAUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TikTok refresh ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    error?: string;
  };
  if (j.error) throw new Error(`TikTok refresh: ${j.error}`);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? args.refreshToken,
    expiresAt: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  };
}

export async function fetchTikTokUserInfo(accessToken: string): Promise<{
  openId: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const url = `${TT_API}/user/info/?fields=open_id,display_name,avatar_url`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TikTok /user/info ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    data?: {
      user?: { open_id?: string; display_name?: string; avatar_url?: string };
    };
  };
  const u = j.data?.user;
  if (!u?.open_id) throw new Error("TikTok: brak open_id w /user/info");
  return {
    openId: u.open_id,
    displayName: u.display_name ?? "TikTok",
    avatarUrl: u.avatar_url ?? null,
  };
}

// =============================================================================
// Adapter
// =============================================================================

async function waitForPublishStatus(args: {
  accessToken: string;
  publishId: string;
}): Promise<{ status: string; publicId?: string | null }> {
  // Polling do 40s (TT zwykle 5-15s).
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${TT_API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: args.publishId }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`TikTok status ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      data?: {
        status?: string;
        publicaly_available_post_id?: string[];
        publicly_available_post_id?: string[];
        fail_reason?: string;
      };
    };
    const status = j.data?.status ?? "UNKNOWN";
    if (status === "PUBLISH_COMPLETE") {
      const ids =
        j.data?.publicly_available_post_id ??
        j.data?.publicaly_available_post_id ??
        [];
      return { status, publicId: ids[0] ?? null };
    }
    if (status === "FAILED") {
      throw new Error(`TikTok publish FAILED: ${j.data?.fail_reason ?? "?"}`);
    }
    if (status === "SEND_TO_USER_INBOX") {
      // Sandbox / brak App Review — film czeka na zatwierdzenie w aplikacji TT.
      return { status, publicId: null };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: "PROCESSING_TIMEOUT", publicId: null };
}

export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const videoUrl = (content.media_urls ?? []).find(Boolean);
    if (!videoUrl) {
      throw new Error("TikTok wymaga URL do pliku wideo w media_urls[0].");
    }
    const title = composeCaption(content) || "Nowy film";

    const initRes = await fetch(`${TT_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: "SELF_ONLY", // sandbox-safe; produkcyjnie zmienić na PUBLIC_TO_EVERYONE
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });
    if (!initRes.ok) {
      const t = await initRes.text();
      throw new Error(`TikTok publish init ${initRes.status}: ${t.slice(0, 300)}`);
    }
    const init = (await initRes.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (init.error && init.error.code !== "ok") {
      throw new Error(
        `TikTok publish init: ${init.error.code} — ${init.error.message ?? ""}`,
      );
    }
    const publishId = init.data?.publish_id;
    if (!publishId) throw new Error("TikTok: brak publish_id w odpowiedzi init.");

    const { status, publicId } = await waitForPublishStatus({
      accessToken: account.access_token,
      publishId,
    });

    const externalPostId = publicId ?? publishId;
    const externalUrl = publicId
      ? `https://www.tiktok.com/@${account.account_name.replace(/^@/, "")}/video/${publicId}`
      : null;

    if (status === "SEND_TO_USER_INBOX") {
      // Zachowujemy publish_id jako externalPostId — film czeka na akceptację.
      return { externalPostId, externalUrl: null };
    }
    return { externalPostId, externalUrl };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    // Działa tylko gdy externalPostId to publiczny video_id (PUBLISH_COMPLETE).
    const res = await fetch(
      `${TT_API}/video/list/?fields=id,like_count,comment_count,share_count,view_count`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ filters: { video_ids: [externalPostId] } }),
      },
    );
    if (!res.ok) {
      // Sandbox / film w inbox → po prostu zero
      return { likes: 0, comments: 0, shares: 0, views: 0 };
    }
    const j = (await res.json()) as {
      data?: {
        videos?: Array<{
          id: string;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
        }>;
      };
    };
    const v = j.data?.videos?.[0];
    return {
      likes: v?.like_count ?? 0,
      comments: v?.comment_count ?? 0,
      shares: v?.share_count ?? 0,
      views: v?.view_count ?? 0,
      raw: (v ?? {}) as Record<string, unknown>,
    };
  },

  async fetchInboxItems(): Promise<PlatformInboxItem[]> {
    // TikTok nie udostępnia publicznego API do listy komentarzy.
    return [];
  },

  async reply(): Promise<PlatformReplyResult> {
    throw new Error(
      "TikTok nie udostępnia publicznego API do odpowiadania na komentarze — odpowiedz w aplikacji TikTok.",
    );
  },
};

export type _AccountUnused = PlatformAccount;
