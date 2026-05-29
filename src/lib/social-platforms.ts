// Wspólna metadata platform SM — używana zarówno w UI jak i w server fn.
// Plik isomorphic (brak importów server-only).

export type SocialPlatformId =
  | "facebook"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "twitter"
  | "tiktok"
  | "spotify_artists";

export type SocialPlatformMeta = {
  id: SocialPlatformId;
  /** Klucz koloru w Tailwind (do badge'y) */
  brandColor: string;
  /** Czy platforma jest aktywna w Concertivo (po OAuth) */
  status: "live" | "coming_soon" | "planned";
  /** Czy publikacja wymaga App Review u dostawcy */
  requiresAppReview: boolean;
  /** Czy API jest płatne */
  requiresPaidApi: boolean;
  /** Czy obsługuje publikację postów tekstowych */
  supportsText: boolean;
  /** Czy obsługuje publikację zdjęć */
  supportsImages: boolean;
  /** Czy obsługuje publikację filmów */
  supportsVideo: boolean;
  /** Czy obsługuje czytanie statystyk */
  supportsMetrics: boolean;
  /** Maksymalna długość tekstu (znaki) — null = brak limitu/duży */
  maxTextLength: number | null;
  /** Domyślny ton dla AI */
  aiTone: "long" | "short" | "hashtag-heavy" | "professional" | "casual";
  /** Wymagane OAuth scopes (do wyświetlenia w wizardzie) */
  scopes: string[];
  /** Klucz w runtime secrets z client_id (do sprawdzenia gotowości) */
  envClientIdKey: string;
};

export const SOCIAL_PLATFORMS: Record<SocialPlatformId, SocialPlatformMeta> = {
  facebook: {
    id: "facebook",
    brandColor: "bg-[#1877F2]",
    status: "live",
    requiresAppReview: true,
    requiresPaidApi: false,
    supportsText: true,
    supportsImages: true,
    supportsVideo: true,
    supportsMetrics: true,
    maxTextLength: 63206,
    aiTone: "long",
    scopes: [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_manage_engagement",
      "pages_read_user_content",
    ],
    envClientIdKey: "META_APP_ID",
  },
  instagram: {
    id: "instagram",
    brandColor: "bg-gradient-to-tr from-[#FFDC80] via-[#E1306C] to-[#833AB4]",
    status: "live",
    requiresAppReview: true,
    requiresPaidApi: false,
    supportsText: true,
    supportsImages: true,
    supportsVideo: true,
    supportsMetrics: true,
    maxTextLength: 2200,
    aiTone: "hashtag-heavy",
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"],
    envClientIdKey: "META_APP_ID",
  },
  youtube: {
    id: "youtube",
    brandColor: "bg-[#FF0000]",
    status: "coming_soon",
    requiresAppReview: false,
    requiresPaidApi: false,
    supportsText: false,
    supportsImages: false,
    supportsVideo: true,
    supportsMetrics: true,
    maxTextLength: 5000,
    aiTone: "professional",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    envClientIdKey: "GOOGLE_CLIENT_ID",
  },
  linkedin: {
    id: "linkedin",
    brandColor: "bg-[#0A66C2]",
    status: "live",
    requiresAppReview: false,
    requiresPaidApi: false,
    supportsText: true,
    supportsImages: true,
    supportsVideo: false,
    supportsMetrics: true,
    maxTextLength: 3000,
    aiTone: "professional",
    scopes: ["openid", "profile", "email", "w_member_social"],
    envClientIdKey: "LINKEDIN_CLIENT_ID",
  },

  twitter: {
    id: "twitter",
    brandColor: "bg-[#000000]",
    status: "live",
    requiresAppReview: false,
    requiresPaidApi: true,
    supportsText: true,
    supportsImages: true,
    supportsVideo: true,
    supportsMetrics: true,
    maxTextLength: 280,
    aiTone: "short",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    envClientIdKey: "TWITTER_CLIENT_ID",
  },
  tiktok: {
    id: "tiktok",
    brandColor: "bg-[#000000]",
    status: "planned",
    requiresAppReview: true,
    requiresPaidApi: false,
    supportsText: false,
    supportsImages: false,
    supportsVideo: true,
    supportsMetrics: true,
    maxTextLength: 2200,
    aiTone: "casual",
    scopes: ["video.upload", "video.publish", "user.info.basic"],
    envClientIdKey: "TIKTOK_CLIENT_KEY",
  },
  spotify_artists: {
    id: "spotify_artists",
    brandColor: "bg-[#1DB954]",
    status: "planned",
    requiresAppReview: false,
    requiresPaidApi: false,
    supportsText: false,
    supportsImages: false,
    supportsVideo: false,
    supportsMetrics: true,
    maxTextLength: null,
    aiTone: "professional",
    scopes: ["user-read-private", "user-top-read"],
    envClientIdKey: "SPOTIFY_CLIENT_ID",
  },
};

export const SOCIAL_PLATFORM_ORDER: SocialPlatformId[] = [
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "twitter",
  "tiktok",
  "spotify_artists",
];

export function getPlatformMeta(id: SocialPlatformId): SocialPlatformMeta {
  return SOCIAL_PLATFORMS[id];
}
