// SERVER-ONLY. Adapter Spotify (Web API, OAuth 2.0 Authorization Code).
//
// Spotify dla Concertivo to integracja READ-ONLY: pobieramy statystyki
// profilu wykonawcy/użytkownika (followers, popularity, top tracks).
// NIE publikujemy nic na Spotify — publish() rzuca błędem.
//
// Endpointy:
//  - POST https://accounts.spotify.com/api/token            — code exchange + refresh
//  - GET  https://api.spotify.com/v1/me                      — profil zalogowanego użytkownika
//  - GET  https://api.spotify.com/v1/artists/{id}            — statystyki wykonawcy
//  - GET  https://api.spotify.com/v1/me/top/artists          — top wykonawcy użytkownika (opcjonalnie)
//
// W "external_account_id" zapisujemy ID profilu Spotify użytkownika (nie artysty).
// Jeżeli organizacja chce metryk konkretnego artysty, ID artysty należy dodać
// w polu account_name jako sufix "spotify:artist:XXX" lub przez osobną kolumnę
// (TODO Tura 7). MVP: pobieramy followers użytkownika.

import type {
  PlatformAdapter,
  PlatformAccount,
  PlatformInboxItem,
  PlatformMetrics,
  PlatformPublishResult,
  PlatformReplyResult,
} from "./types";

const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

// =============================================================================
// OAuth — code → token / refresh / me
// =============================================================================

export async function exchangeSpotifyCode(args: {
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
  const basic = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify token exchange ${res.status}: ${t.slice(0, 300)}`);
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

export async function refreshSpotifyToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }> {
  const basic = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify refresh ${res.status}: ${t.slice(0, 300)}`);
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

export async function fetchSpotifyMe(accessToken: string): Promise<{
  id: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
}> {
  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify /me ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    id: string;
    display_name?: string;
    images?: Array<{ url?: string }>;
    followers?: { total?: number };
  };
  return {
    id: j.id,
    displayName: j.display_name ?? `Spotify ${j.id.slice(0, 6)}`,
    avatarUrl: j.images?.[0]?.url ?? null,
    followers: j.followers?.total ?? 0,
  };
}

export async function fetchSpotifyArtist(args: {
  accessToken: string;
  artistId: string;
}): Promise<{
  id: string;
  name: string;
  followers: number;
  popularity: number;
  genres: string[];
}> {
  const res = await fetch(`${SPOTIFY_API}/artists/${encodeURIComponent(args.artistId)}`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify /artists ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    id: string;
    name: string;
    followers?: { total?: number };
    popularity?: number;
    genres?: string[];
  };
  return {
    id: j.id,
    name: j.name,
    followers: j.followers?.total ?? 0,
    popularity: j.popularity ?? 0,
    genres: j.genres ?? [],
  };
}

// =============================================================================
// Adapter
// =============================================================================

export const spotifyAdapter: PlatformAdapter = {
  platformId: "spotify_artists",

  async publish(): Promise<PlatformPublishResult> {
    throw new Error(
      "Spotify nie obsługuje publikacji postów przez API — integracja jest read-only (tylko statystyki).",
    );
  },

  async fetchMetrics({ account }): Promise<PlatformMetrics> {
    // MVP: pobieramy followers profilu zalogowanego użytkownika.
    // (Spotify nie udostępnia metryk per-post w sensie społecznościowym.)
    const me = await fetchSpotifyMe(account.access_token);
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      views: me.followers,
      raw: { followers: me.followers, displayName: me.displayName },
    };
  },

  async fetchInboxItems(): Promise<PlatformInboxItem[]> {
    // Spotify nie ma komentarzy.
    return [];
  },

  async reply(): Promise<PlatformReplyResult> {
    throw new Error("Spotify nie udostępnia API komentarzy.");
  },
};

export type _AccountUnused = PlatformAccount;
