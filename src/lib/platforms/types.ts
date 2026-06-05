// Wspólny interfejs adaptera per platforma SM.
// Pliki implementujące: src/lib/platforms/{platform}.server.ts
// Plik isomorphic (sam interfejs/typy, brak importów server-only).

import type { SocialPlatformId } from "../social-platforms";

export type MediaItem = {
  url: string;
  type: "image" | "video";
  thumbnail_url?: string | null;
};

export type PlatformPostContent = {
  text?: string;
  hashtags?: string[];
  media_urls?: string[];
  media_items?: MediaItem[];
};

export type PlatformAccount = {
  id: string;
  organization_id: string;
  platform: string;
  external_account_id: string;
  account_name: string;
  scopes?: string[];
  access_token: string; // ODSZYFROWANY
  refresh_token: string | null; // ODSZYFROWANY
  token_expires_at: string | null;
};

export type PlatformPublishResult = {
  externalPostId: string;
  externalUrl: string | null;
};

export type PlatformMetrics = {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  raw?: Record<string, unknown>;
};

export type PlatformInboxItem = {
  externalCommentId: string;
  externalParentCommentId?: string | null;
  externalPostId: string;
  authorExternalId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  content: string;
  permalink: string | null;
  postedAt: string | null;
  likeCount?: number;
  replyCount?: number;
};

export type PlatformReplyResult = {
  externalCommentId: string;
};

export type PlatformRecentPost = {
  externalPostId: string;
  externalUrl: string | null;
  text: string;
  mediaUrls: string[];
  mediaItems?: MediaItem[];
  postedAt: string | null;
};

export interface PlatformAdapter {
  platformId: SocialPlatformId;

  /** Opublikuj post na platformie. Otrzymujemy odszyfrowane konto + treść. */
  publish(args: {
    account: PlatformAccount;
    content: PlatformPostContent;
    clientId: string;
    clientSecret: string;
  }): Promise<PlatformPublishResult>;

  /** Pobierz aktualne metryki dla posta. */
  fetchMetrics(args: {
    account: PlatformAccount;
    externalPostId: string;
    clientId: string;
    clientSecret: string;
  }): Promise<PlatformMetrics>;

  /** Pobierz nowe komentarze/odpowiedzi do posta. */
  fetchInboxItems(args: {
    account: PlatformAccount;
    externalPostId: string;
    sinceIso: string | null;
    clientId: string;
    clientSecret: string;
  }): Promise<PlatformInboxItem[]>;

  /** Odpowiedz na komentarz (wątek) — opcjonalne; jeśli platforma nie wspiera, throw. */
  reply?(args: {
    account: PlatformAccount;
    externalParentCommentId: string;
    externalPostId: string;
    text: string;
    clientId: string;
    clientSecret: string;
  }): Promise<PlatformReplyResult>;

  /** Polub post lub komentarz jako połączone konto/strona, jeśli API platformy to wspiera. */
  like?(args: {
    account: PlatformAccount;
    target: "post" | "comment";
    externalId: string;
    externalPostId?: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ ok: boolean }>;

  /** Pobierz N ostatnio opublikowanych postów z konta (do importu historii / synchronizacji). */
  listRecentPosts?(args: {
    account: PlatformAccount;
    limit: number;
    clientId: string;
    clientSecret: string;
  }): Promise<PlatformRecentPost[]>;
}
