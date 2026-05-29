// SERVER-ONLY. Adapter LinkedIn — publikacja, metryki, inbox, odpowiedzi.
// OAuth 2.0 (z opcjonalnym PKCE). Posty członka (personal) przez UGC API.
//
// API:
//  - POST /v2/ugcPosts                                      — publikacja
//  - POST /v2/assets?action=registerUpload + PUT            — upload obrazka
//  - GET  /v2/socialActions/{shareUrn}                      — metryki
//  - GET  /v2/socialActions/{shareUrn}/comments             — komentarze
//  - POST /v2/socialActions/{shareUrn}/comments             — odpowiedź
//  - GET  https://api.linkedin.com/v2/userinfo              — OIDC userinfo
//  - POST https://www.linkedin.com/oauth/v2/accessToken     — token + refresh

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPostContent,
  PlatformPublishResult,
  PlatformReplyResult,
} from "./types";

const LINKEDIN_API = "https://api.linkedin.com";
const LINKEDIN_OAUTH = "https://www.linkedin.com/oauth/v2";

function authorUrn(account: PlatformAccount): string {
  // external_account_id przechowuje "sub" z /userinfo (id członka)
  return `urn:li:person:${account.external_account_id}`;
}

function composeText(content: PlatformPostContent): string {
  const text = (content.text ?? "").trim();
  const tags = (content.hashtags ?? [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const out = [text, tags].filter(Boolean).join("\n\n");
  if (out.length > 3000) return out.slice(0, 2997) + "…";
  return out;
}

// ---------- upload obrazka ----------

async function registerImageUpload(args: {
  accessToken: string;
  owner: string;
}): Promise<{ uploadUrl: string; asset: string }> {
  const res = await fetch(`${LINKEDIN_API}/v2/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: args.owner,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LinkedIn registerUpload ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    value: {
      asset: string;
      uploadMechanism: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: string };
      };
    };
  };
  return {
    uploadUrl:
      j.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl,
    asset: j.value.asset,
  };
}

async function uploadImage(args: {
  accessToken: string;
  owner: string;
  url: string;
}): Promise<string> {
  const fileRes = await fetch(args.url);
  if (!fileRes.ok) throw new Error(`Nie pobrano obrazka (${args.url}): HTTP ${fileRes.status}`);
  const buf = Buffer.from(await fileRes.arrayBuffer());
  const reg = await registerImageUpload({ accessToken: args.accessToken, owner: args.owner });
  const put = await fetch(reg.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${args.accessToken}` },
    body: buf,
  });
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`LinkedIn upload PUT ${put.status}: ${t.slice(0, 200)}`);
  }
  return reg.asset;
}

// ---------- adapter ----------

export const linkedinAdapter: PlatformAdapter = {
  platformId: "linkedin",

  async publish({ account, content }): Promise<PlatformPublishResult> {
    const author = authorUrn(account);
    const text = composeText(content);

    const mediaAssets: string[] = [];
    if (content.media_urls?.length) {
      for (const url of content.media_urls.slice(0, 9)) {
        const asset = await uploadImage({
          accessToken: account.access_token,
          owner: author,
          url,
        });
        mediaAssets.push(asset);
      }
    }

    const shareMediaCategory = mediaAssets.length ? "IMAGE" : "NONE";
    const body = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory,
          media: mediaAssets.map((asset) => ({
            status: "READY",
            media: asset,
          })),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };

    const res = await fetch(`${LINKEDIN_API}/v2/ugcPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LinkedIn publish ${res.status}: ${t.slice(0, 300)}`);
    }
    const ugcId = res.headers.get("x-restli-id") ?? ((await res.json()) as { id?: string }).id;
    if (!ugcId) throw new Error("LinkedIn publish: brak id w odpowiedzi");

    // LinkedIn permalink: /feed/update/{ugcUrn}
    const permalink = `https://www.linkedin.com/feed/update/${encodeURIComponent(ugcId)}`;
    return { externalPostId: ugcId, externalUrl: permalink };
  },

  async fetchMetrics({ account, externalPostId }): Promise<PlatformMetrics> {
    const urn = encodeURIComponent(externalPostId);
    const res = await fetch(`${LINKEDIN_API}/v2/socialActions/${urn}`, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LinkedIn metrics ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number; aggregatedTotalComments?: number };
    };
    return {
      likes: j.likesSummary?.totalLikes ?? 0,
      comments:
        j.commentsSummary?.aggregatedTotalComments ??
        j.commentsSummary?.totalFirstLevelComments ??
        0,
      shares: 0,
      views: 0,
      raw: j as Record<string, unknown>,
    };
  },

  async fetchInboxItems({ account, externalPostId }): Promise<PlatformInboxItem[]> {
    const urn = encodeURIComponent(externalPostId);
    const res = await fetch(
      `${LINKEDIN_API}/v2/socialActions/${urn}/comments?count=50`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LinkedIn comments ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      elements?: Array<{
        id?: string;
        $URN?: string;
        actor: string;
        created: { time: number };
        message: { text: string };
      }>;
    };
    return (j.elements ?? []).map((c): PlatformInboxItem => {
      const id = c.id ?? c.$URN ?? "";
      return {
        externalCommentId: id,
        externalParentCommentId: null,
        externalPostId,
        authorExternalId: c.actor,
        authorName: null, // LinkedIn /v2/people/{id} wymaga dodatkowych scopes
        authorAvatarUrl: null,
        content: c.message?.text ?? "",
        permalink: `https://www.linkedin.com/feed/update/${encodeURIComponent(externalPostId)}`,
        postedAt: c.created?.time ? new Date(c.created.time).toISOString() : null,
      };
    });
  },

  async reply({ account, externalPostId, text }): Promise<PlatformReplyResult> {
    const author = authorUrn(account);
    const urn = encodeURIComponent(externalPostId);
    const safe = text.length > 1250 ? text.slice(0, 1247) + "…" : text;
    const res = await fetch(`${LINKEDIN_API}/v2/socialActions/${urn}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        actor: author,
        message: { text: safe },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LinkedIn reply ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = (await res.json()) as { id?: string; $URN?: string };
    const id = j.id ?? j.$URN ?? "";
    if (!id) throw new Error("LinkedIn reply: brak id w odpowiedzi");
    return { externalCommentId: id };
  },
};

// ---------- token exchange + refresh ----------

export async function exchangeLinkedInCode(args: {
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
  const res = await fetch(`${LINKEDIN_OAUTH}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LinkedIn token exchange ${res.status}: ${t.slice(0, 300)}`);
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

export async function refreshLinkedInToken(args: {
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
    client_secret: args.clientSecret,
  });
  const res = await fetch(`${LINKEDIN_OAUTH}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LinkedIn refresh ${res.status}: ${t.slice(0, 300)}`);
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

export async function fetchLinkedInUserInfo(accessToken: string): Promise<{
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}> {
  const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LinkedIn /userinfo ${res.status}: ${t.slice(0, 200)}`);
  }
  return (await res.json()) as { sub: string; name?: string; email?: string; picture?: string };
}
