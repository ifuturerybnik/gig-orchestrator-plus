// Wspólny interfejs adaptera per platforma SM.
// Pliki implementujące: src/lib/platforms/{platform}.server.ts
// Plik isomorphic (sam interfejs/typy, brak importów server-only).

import type { SocialPlatformId } from "../social-platforms";

export type PlatformPostContent = {
  text?: string;
  hashtags?: string[];
  media_urls?: string[];
};

export type PlatformAccount = {
  id: string;
  organization_id: string;
  platform: string;
  external_account_id: string;
  account_name: string;
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
}
