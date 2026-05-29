# Plan: pełna integracja Social Media — wszystkie 7 platform

## Stan obecny (już mamy)

- ✅ UI: 5 zakładek (Konta, Inbox, AI Studio, Harmonogram, Statystyki)
- ✅ Tabele DB: `social_accounts`, `social_posts`, `social_app_credentials`, `social_oauth_states`, `social_inbox_comments`
- ✅ Server fns CRUD (`src/lib/social.functions.ts`) — konta, posty, AI generowanie, inbox, OAuth start
- ✅ Tylko X (Twitter): callback OAuth (`api/public/social.x-callback`) + handler tokena
- ✅ Cron `social-publish-scheduled` — szkielet (bez faktycznych wywołań API platform)

## Czego brakuje

Dla **6 z 7 platform** brakuje całej integracji z API providera. Wszystkie wpisy w `SOCIAL_PLATFORMS` mają status `coming_soon` lub `planned` — żadna nie jest `live`.

---

## Podział na tury

Każda tura jest **samowystarczalna** (możesz testować po kolei) i zamyka się w ~1 zwartej iteracji. Po każdej proszę o akceptację, zanim ruszę dalej.

### **Tura 1: X (Twitter) — DOKOŃCZENIE → status `live`** ⭐ start tutaj
Najszybsza wygrana (callback już jest):
- Implementacja `publishToTwitter()` w `social-publish.server.ts` (POST `/2/tweets`, upload mediów przez `/1.1/media/upload`)
- Odświeżanie tokenów (`refresh_token` flow)
- Pobieranie metryk (impressions/likes/retweets z `/2/tweets/:id?tweet.fields=public_metrics`)
- Pobieranie odpowiedzi do inbox (`/2/tweets/search/recent` z `conversation_id`)
- Zmiana statusu w `social-platforms.ts` na `"live"`
- **Plik instrukcji setupu już istnieje** (`XSetupInstructions.tsx`)

### **Tura 2: LinkedIn — `live`**
Druga najprostsza (jeden user, jeden token, OAuth standardowy):
- Callback `api/public/social.linkedin-callback.ts`
- `handleLinkedInOAuthCallback` w `social-oauth.server.ts`
- `publishToLinkedIn()` — POST `/v2/ugcPosts` (tekst + obrazek przez `/v2/assets`)
- Refresh tokenów (60 dni)
- Metryki: `/v2/socialActions/{shareUrn}`
- Komentarze inbox: `/v2/socialActions/{shareUrn}/comments`
- Instrukcja setupu `LinkedInSetupInstructions.tsx`

### **Tura 3: Facebook + Instagram (Meta Graph API) — `live`** ✅ DONE
- ✅ Callback `api/public/social.meta-callback.ts` (wspólny dla FB + IG)
- ✅ Adapter `platforms/meta.server.ts` z `facebookAdapter` + `instagramAdapter`
- ✅ `publishToFacebook` (tekst, /photos, gallery przez attached_media)
- ✅ `publishToInstagram` (2-stopniowo /media → poll status → /media_publish, carousel)
- ✅ Long-lived page tokens (60 dni → never-expire dla page token)
- ✅ Metryki: FB likes/comments/shares + IG like_count/comments_count + insights.reach
- ✅ Inbox: FB /comments z `since`, IG /comments + reply (FB /comments, IG /replies)
- ✅ Instrukcja `MetaSetupInstructions.tsx` + integracja w `AppCredentialsForm`
- ✅ Credentials współdzielone: IG zawsze patrzy w rekord `platform="facebook"`

### **Tura 4: YouTube — `live`**
- Callback `api/public/social.youtube-callback.ts` (Google OAuth)
- `publishToYouTube()` — resumable upload `/upload/youtube/v3/videos` (chunki, bo pliki duże)
- Refresh tokenów (długoterminowe)
- Metryki: `/youtube/analytics/v2/reports`
- Komentarze inbox: `/v3/commentThreads?videoId=`
- Instrukcja `YouTubeSetupInstructions.tsx`
- Uwaga: tylko video — brak postów tekstowych

### **Tura 5: TikTok — `live`**
- Callback `api/public/social.tiktok-callback.ts`
- `publishToTikTok()` — Content Posting API (init upload → upload chunks → publish)
- Refresh tokenów
- Metryki: `/video/list/` + `/video/query/`
- Komentarze inbox: brak publicznego API → pomijamy z UI komunikatem
- Instrukcja `TikTokSetupInstructions.tsx` (App Review wymagane!)

### **Tura 6: Spotify Artists — `live` (read-only)**
Tylko metryki, brak publikacji:
- Callback `api/public/social.spotify-callback.ts`
- `syncSpotifyStats()` — odsłuchy z `/v1/me/top/artists` + Spotify for Artists API (jeśli dostępne)
- Inbox wyłączony (Spotify nie ma komentarzy)
- Schowanie zakładek Publikuj/Harmonogram dla tej platformy
- Instrukcja `SpotifySetupInstructions.tsx`

### **Tura 7 (FINAŁ): Spinanie całości**
- Update cron `social-publish-scheduled` — wywołanie `publishToX()` per platforma w pętli
- Job pollujący metryki (`social-sync-metrics` cron co 1h)
- Job pollujący komentarze (`social-sync-inbox` cron co 15min)
- Aktualizacja `SOCIAL_PLATFORMS` — wszystko `"live"`
- Tłumaczenia pl/en dla nowych komunikatów
- Testy E2E (manualnie z Twojej strony, kod gotowy)

---

## Szczegóły techniczne (wspólne dla wszystkich tur)

### Architektura per-platforma
Każda nowa platforma dostaje:

```
src/lib/platforms/{platform}.server.ts    — publish + metrics + inbox sync
src/routes/api/public/social.{platform}-callback.ts
src/components/social/setup/{Platform}SetupInstructions.tsx
```

Wspólny interfejs w `src/lib/platforms/types.ts`:
```ts
export interface PlatformAdapter {
  publish(args): Promise<{ externalPostId: string; permalink: string }>;
  refreshToken(args): Promise<{ accessToken; refreshToken?; expiresAt }>;
  fetchMetrics(args): Promise<{ likes; comments; shares; impressions }>;
  fetchInboxItems(args): Promise<InboxItem[]>;
}
```

Dispatcher `publishToPlatform(platform, ...)` wybiera adapter — używany w cronie i `publishPostNow()`.

### Migracje DB
Każda tura może dodać kolumny (np. `social_posts.platform_post_ids JSONB` — mapowanie platform → external id). Migracje pisane jako pliki `.sql` w `supabase/migrations/` zgodnie z core memory; Ty wykonujesz je ręcznie w panelu Supabase.

### Bezpieczeństwo
- Wszystkie tokeny szyfrowane AES-256-GCM (mamy już `encryptPii`/`decryptPii`)
- Callback URLs ZAWSZE pod `/api/public/social.*-callback` (stały URL → wpisujesz raz w developer console)
- State + PKCE dla każdego OAuth (bazujemy na obecnym wzorcu X)
- `social_app_credentials` per organizacja (każda firma ma swój własny App ID w Meta/Google/LinkedIn)

### Refresh tokenów
Wspólny helper `getValidAccessToken(accountId)` — sprawdza `token_expires_at`, jeśli wygasł → odświeża, zapisuje nowy, zwraca aktualny. Używany przed każdym wywołaniem API.

---

## Pytania zanim ruszę

1. **Zaczynam od Tury 1 (X/Twitter)?** Jeśli tak — od razu lecę i wrócę z gotową integracją (publikacja + metryki + inbox + status `live`).
2. Czy potwierdzasz **per-organizacja App Credentials** (każdy klient Concertivo wpisuje WŁASNE Client ID/Secret w UI)? Tak działa już X — chcę utrzymać ten wzorzec dla wszystkich.
3. Czy **Spotify Artists** jest dla Ciebie krytyczny? Spotify nie ma publicznego API dla statystyk artysty (Spotify for Artists API jest closed beta). Mogę zrobić tylko "moje top utwory" z konta usera lub całkowicie pominąć tę platformę i oznaczyć ją `planned: gdy Spotify otworzy API`.

Jak potwierdzisz, zaczynam Turę 1.
