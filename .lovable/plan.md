# Moduł "Integracje SM" dla Concertivo

## Rzeczywistość integracji z SM (musisz to wiedzieć przed startem)

Integracja z Facebook, Instagram, YouTube, LinkedIn, TikTok, X **nie jest plug-and-play**. Każda platforma wymaga:

1. **Twojej aplikacji deweloperskiej** zarejestrowanej u dostawcy (Meta for Developers, Google Cloud Console, LinkedIn Developers, X Developer Portal). To Ty jako i-Future zakładasz raz "Concertivo App", a wszystkie organizacje używają jej do logowania.
2. **App Review** (Meta i TikTok wymagają, Google YouTube częściowo, LinkedIn dla niektórych scope) — proces trwa 1–4 tygodnie i wymaga screencastów oraz polityki prywatności.
3. **OAuth Redirect URI** wskazującego na Concertivo (musi być HTTPS, stała domena — czyli po wdrożeniu na Hostinger VPS).
4. **Płatnego API w przypadku X/Twitter** (~100 USD/mc Basic).
5. **Spotify for Artists nie ma publicznego API** do publikacji — tylko statystyki przez Spotify for Developers, i to ograniczone.

Dlatego proponuję **podejście warstwowe**: w turze 1 budujemy całą infrastrukturę modułu (UI, DB, AI), tak żeby OAuth dla każdej platformy dokładać niezależnie w kolejnych turach.

## Tura 1 (TA implementacja) — Fundament + AI Studio + tutoriale

### A. Struktura modułu
- Nowa sekcja w sidebar organizacji: **"Integracje SM"** (`/organizations/:orgId/social`)
- Cztery zakładki:
  1. **Połączone konta** — lista platform z statusem (Połączono / Nie połączono), per-platform "Połącz" otwiera wizard
  2. **AI Studio** — generator postów z AI (działa od razu, bo używa istniejącego OpenAI)
  3. **Harmonogram** — kalendarz zaplanowanych postów (te same konwencje co istniejący `<Calendar />`)
  4. **Statystyki** — szkielet pod metryki (puste do momentu OAuth)

### B. Baza danych (migracja `0028_social_integrations.sql`)
- `social_platforms` (słownik) — facebook, instagram, youtube, linkedin, twitter, tiktok, spotify_artists; pole `requires_app_review`, `requires_paid_api`, status w Concertivo (live/coming_soon)
- `social_accounts` — per organizacja: `platform`, `external_account_id`, `account_name`, `access_token_enc` (szyfrowane EXT_PII_ENCRYPTION_KEY), `refresh_token_enc`, `token_expires_at`, `scopes`, `connected_by`, `connected_at`
- `social_posts` — draft/scheduled/published/failed; `org_id`, `created_by`, `content_per_platform` (JSONB: różne wersje dla różnych platform), `target_platforms[]`, `scheduled_at`, `published_at`, `linked_event_id` (FK do performances), `linked_vacation_id` (opcjonalnie)
- `social_post_results` — wynik publikacji per platforma (success/error, external_post_id, error_message)
- `social_post_metrics` — likes/comments/shares/views per post per platforma, snapshot z datą
- Wszystkie z RLS scoped per org_id + GRANT dla authenticated/service_role

### C. AI Studio (działa od razu, używa OpenAI z modułu Administracja)
Cztery generatory:
1. **Z wydarzenia** — wybierasz wydarzenie z kalendarza → AI generuje post (tytuł, opis, hashtagi, sugestię obrazka) na bazie: nazwa, data, miejsce, artyści, link do biletów
2. **Z pustego promptu** — wpisujesz temat → AI proponuje post
3. **Adaptacja per platforma** — jeden temat → cztery wersje (FB długa, IG hashtagowa, LI profesjonalna, X krótka <280)
4. **Sugestia best time** — AI na podstawie typu treści proponuje optymalny dzień+godzinę

Wszystko zapisuje się jako `social_posts` ze statusem `draft`.

### D. Tutoriale "łopatologiczne" per platforma
Dla każdej platformy osobny ekran w stylu krok-po-kroku ze zrzutami ekranu i checklistami:
- **Co dostaniesz** (publikacja postów, czytanie komentarzy, statystyki)
- **Czego potrzebujesz** (np. Facebook Page admin, Instagram Business Account, kanał YT z >0 subskrybentów)
- **Krok 1**: Co kliknąć w Concertivo
- **Krok 2**: Co zobaczysz na ekranie platformy
- **Krok 3**: Jakie uprawnienia zatwierdzić i dlaczego
- **Krok 4**: Jak zweryfikować że działa
- **FAQ**: typowe problemy (np. "IG wymaga konta Business połączonego z FB Page")
- **Ograniczenia** (np. "TikTok pozwala publikować max 10 filmów/dzień")

Treści tutoriali w `pl.ts`/`en.ts` (i18next).

### E. Wizard połączenia (stub OAuth)
Per platforma przycisk "Połącz" otwiera dialog wizard:
- Krok 1: tutorial + checklist "Mam Facebook Page", "Jestem adminem"
- Krok 2: "Kliknij aby przejść do logowania" — w turze 1 pokazuje komunikat "Wkrótce — OAuth zostanie aktywowany po publikacji aplikacji u dostawcy"
- Architektura gotowa: server fn `connectSocialAccount(platform, code)` istnieje, OAuth handler `/api/public/social/callback/:platform` przygotowany — czeka tylko na client_id/secret w runtime secrets

### F. i18n
Pełne tłumaczenia pl/en dla całego modułu: nazwy platform, statusy, tutoriale, komunikaty AI, formularz harmonogramu.

## Tury kolejne (do uzgodnienia po turze 1)

- **Tura 2**: Facebook + Instagram OAuth + publikacja postów + odczyt komentarzy + statystyki (Meta Graph API — jedna app obsługuje obie platformy)
- **Tura 3**: LinkedIn OAuth + publikacja na Company Page + statystyki
- **Tura 4**: YouTube Data API v3 — upload filmów, statystyki kanału, lista filmów
- **Tura 5**: X / Twitter (wymaga decyzji o płatnym API)
- **Tura 6**: Spotify for Artists (jeśli ktoś ma estradową org) — tylko statystyki
- **Tura 7**: TikTok (wymaga App Review)
- **Tura 8**: Cron `pg_cron` + server route `/api/public/social/publish-scheduled` — publikacja zaplanowanych postów

## Detale techniczne

- **Tokeny SM**: szyfrowane w `social_accounts.access_token_enc` tym samym AES-256-GCM co PESEL/IBAN (helpery z `crypto.server.ts`, klucz `EXT_PII_ENCRYPTION_KEY`)
- **OAuth callback**: server route TanStack `src/routes/api/public/social/callback.$platform.tsx` (jeden plik, switch po `params.platform`)
- **State token**: krótkotrwały JWT-like w `social_oauth_states` (org_id + user_id + platform + redirect_back) — chroni przed CSRF
- **Refresh tokens**: cron co 12h sprawdza `token_expires_at` i odświeża (osobna server fn)
- **AI calls**: przez istniejący `ai.functions.ts` (`callAi(scenariusz: "social_post_generate", ...)`) — dodajemy nowe scenariusze do tabeli `ai_konfiguracja.scenariusz_model`
- **Pamięć projektu**: dodam memory `social-integrations` z konwencjami modułu (per-org accounts, gdzie OAuth, jak AI scenariusze nazwane)

## Co nie jest w zakresie tury 1

- Faktyczne wywołania API Facebook/IG/YT/LI/X/TikTok — wymagają zarejestrowanych aplikacji deweloperskich (które najpierw musisz założyć Ty jako i-Future, dostarczę instrukcję w turze 2)
- Upload filmów do YouTube/TikTok — wymaga obsługi dużych plików, dorobimy w turze ich platform
- Real-time webhooki (np. komentarze) — Tura 8+
