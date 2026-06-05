import { jsPDF } from "jspdf";

type Lang = "pl" | "en";

type Section = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
};

type Guide = {
  title: string;
  subtitle: string;
  intro: string[];
  sections: Section[];
  footer: string;
};

const GUIDES: Record<"integration" | "webhooks", Record<Lang, Guide>> = {
  integration: {
    pl: {
      title: "Concertivo — Integracja strony WWW",
      subtitle: "Instrukcja techniczna dla właściciela / webmastera platformy",
      intro: [
        "Ten dokument opisuje krok po kroku, jak podłączyć stronę WWW organizacji do panelu Concertivo, aby aktualności, wydarzenia i galeria publikowane w aplikacji pojawiały się automatycznie na stronie internetowej.",
        "Integracja jest jednokierunkowa (Concertivo -> Twoja strona) i opiera się o publiczne endpointy JSON oraz opcjonalny skrypt embed.js. Nie wymaga instalacji żadnego oprogramowania po stronie serwera — wystarczy edycja szablonu strony.",
      ],
      sections: [
        {
          heading: "1. Co trzeba mieć przed startem",
          bullets: [
            "Dostęp do panelu Concertivo z uprawnieniami administratora organizacji.",
            "Możliwość edycji kodu HTML strony WWW (CMS, WordPress, statyczny HTML, framework JS — dowolny).",
            "Adres URL strony, na której pojawi się treść (np. https://twoja-strona.pl/aktualnosci).",
          ],
        },
        {
          heading: "2. Konfiguracja po stronie Concertivo",
          paragraphs: [
            "W panelu organizacji wejdź w Moduł Web -> zakładka Integracja WWW i wykonaj:",
          ],
          bullets: [
            "Ustaw publiczny slug organizacji (np. filharmonia-szczecinska) — jest częścią adresów endpointów.",
            "Zaznacz checkbox „Opublikowane” — bez tego endpointy zwracają 404.",
            "Dodaj domenę strony WWW (np. example.com) — chroni przed wykorzystaniem Twoich danych przez obce serwisy (CORS).",
            "Opcjonalnie wygeneruj token API — wymagany tylko dla prywatnych/podglądowych endpointów. Endpointy publiczne nie wymagają tokenu.",
          ],
        },
        {
          heading: "3. Endpointy publiczne (JSON)",
          paragraphs: [
            "Wszystkie endpointy zwracają standard JSON, kodowanie UTF-8, nagłówki CORS dla dodanych domen. Parametr ?lang=pl|en przełącza język treści. Parametr ?limit=N (1–50) zmniejsza liczbę elementów.",
          ],
          code: [
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news/{itemSlug}",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/events",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/gallery",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/gallery/{albumSlug}",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news/feed.xml   (RSS)",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/events.ics      (iCal)",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/sitemap.xml     (SEO)",
          ].join("\n"),
        },
        {
          heading: "4. Najszybszy sposób — wklejka embed.js",
          paragraphs: [
            "Dla stron HTML / WordPress wystarczy wkleić poniższy fragment w miejscu, gdzie ma pojawić się sekcja aktualności. Skrypt sam pobiera dane i renderuje listę.",
          ],
          code:
            '<div id="concertivo-feed"></div>\n' +
            '<script async\n' +
            '  src="https://concertivo.eu/api/public/v1/embed.js"\n' +
            '  data-org="{slug}"\n' +
            '  data-mode="news"     <!-- news | events | gallery -->\n' +
            '  data-lang="pl"\n' +
            '  data-limit="6"\n' +
            '  data-target="#concertivo-feed"></script>',
        },
        {
          heading: "5. Własna integracja (React / Vue / PHP / dowolny backend)",
          paragraphs: [
            "Jeśli masz własny szablon i chcesz pełnej kontroli nad wyglądem, po prostu pobierz JSON i wyrenderuj go po swojej stronie. Przykład w przeglądarce:",
          ],
          code:
            "const r = await fetch(\n" +
            "  'https://concertivo.eu/api/public/v1/orgs/{slug}/news?lang=pl&limit=10'\n" +
            ");\n" +
            "const data = await r.json();\n" +
            "// data.items = [{ id, slug, title, excerpt, cover_url, published_at, ... }]\n" +
            "render(data.items);",
        },
        {
          heading: "6. SEO — mapy strony i kanały RSS",
          bullets: [
            "Dodaj link <link rel=\"alternate\" type=\"application/rss+xml\" href=\".../news/feed.xml\"> w <head> strony.",
            "W pliku robots.txt lub w panelu Google Search Console dodaj sitemap: https://concertivo.eu/api/public/v1/orgs/{slug}/sitemap.xml — wyszukiwarki będą indeksować podstrony aktualności.",
            "Endpoint events.ics można podpiąć w Google Calendar / Outlooku jako kalendarz subskrybowany.",
          ],
        },
        {
          heading: "7. Bezpieczeństwo i CORS",
          bullets: [
            "Endpointy są dostępne tylko z domen dodanych w zakładce Integracja WWW (sekcja „Domeny”).",
            "Nie udostępniamy żadnych danych osobowych — tylko treści publiczne (aktualności, wydarzenia, galeria) oznaczone w aplikacji jako „opublikowane”.",
            "Wycofanie publikacji w Concertivo natychmiast usuwa treść z odpowiedzi endpointów.",
          ],
        },
        {
          heading: "8. Najczęstsze problemy",
          bullets: [
            "404 / pusta odpowiedź — sprawdź czy organizacja ma poprawny slug i zaznaczone „Opublikowane”.",
            "Błąd CORS w konsoli — dodaj domenę strony w zakładce Integracja WWW.",
            "Stare dane na stronie — sprawdź cache CDN/przeglądarki; endpointy ustawiają Cache-Control max-age=60.",
            "Brak ikon/zdjęć — pliki są serwowane z naszego CDN R2; upewnij się że Twój CSP (Content-Security-Policy) zezwala na *.concertivo.eu.",
          ],
        },
      ],
      footer:
        "W razie pytań — napisz do administratora platformy (i-Future) lub skorzystaj z dokumentacji pod adresem https://concertivo.eu/docs.",
    },
    en: {
      title: "Concertivo — Website integration",
      subtitle: "Technical guide for website owner / webmaster",
      intro: [
        "This document explains step by step how to connect the organization's website to Concertivo so that news, events and gallery published in the app appear automatically on the website.",
        "The integration is one-way (Concertivo -> your site) and uses public JSON endpoints and an optional embed.js script. No server software installation is required — only editing the page template.",
      ],
      sections: [
        {
          heading: "1. Prerequisites",
          bullets: [
            "Concertivo organization administrator access.",
            "Ability to edit your website HTML (any CMS, WordPress, static HTML, JS framework).",
            "URL of the page where content will appear (e.g. https://your-site.com/news).",
          ],
        },
        {
          heading: "2. Configuration in Concertivo",
          paragraphs: ["Open Web module -> Integration tab and:"],
          bullets: [
            "Set the organization public slug (e.g. my-orchestra) — it is part of endpoint URLs.",
            "Toggle „Published” — without it endpoints return 404.",
            "Add the website domain (e.g. example.com) — required for browser-side requests (CORS).",
            "Optionally create an API token — only needed for private/preview endpoints. Public endpoints work without a token.",
          ],
        },
        {
          heading: "3. Public endpoints (JSON)",
          paragraphs: [
            "All endpoints return UTF-8 JSON with CORS headers for whitelisted domains. ?lang=pl|en switches language, ?limit=N (1-50) limits item count.",
          ],
          code: [
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news/{itemSlug}",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/events",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/gallery",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/gallery/{albumSlug}",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/news/feed.xml   (RSS)",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/events.ics      (iCal)",
            "GET https://concertivo.eu/api/public/v1/orgs/{slug}/sitemap.xml     (SEO)",
          ].join("\n"),
        },
        {
          heading: "4. Fastest way — embed.js snippet",
          paragraphs: [
            "For plain HTML / WordPress paste this snippet where you want the section to appear. The script fetches data and renders it.",
          ],
          code:
            '<div id="concertivo-feed"></div>\n' +
            '<script async\n' +
            '  src="https://concertivo.eu/api/public/v1/embed.js"\n' +
            '  data-org="{slug}"\n' +
            '  data-mode="news"\n' +
            '  data-lang="en" data-limit="6"\n' +
            '  data-target="#concertivo-feed"></script>',
        },
        {
          heading: "5. Custom integration (React / Vue / PHP / any backend)",
          paragraphs: ["If you want full control of the UI, just fetch JSON and render it yourself:"],
          code:
            "const r = await fetch(\n" +
            "  'https://concertivo.eu/api/public/v1/orgs/{slug}/news?lang=en&limit=10'\n" +
            ");\n" +
            "const data = await r.json();\n" +
            "render(data.items);",
        },
        {
          heading: "6. SEO — sitemaps and RSS",
          bullets: [
            "Add <link rel=\"alternate\" type=\"application/rss+xml\" href=\".../news/feed.xml\"> in <head>.",
            "Submit https://concertivo.eu/api/public/v1/orgs/{slug}/sitemap.xml to Google Search Console.",
            "events.ics can be subscribed to from Google Calendar / Outlook.",
          ],
        },
        {
          heading: "7. Security & CORS",
          bullets: [
            "Endpoints are accessible only from domains added in the Integration tab.",
            "No personal data is exposed — only public content marked as „published”.",
            "Unpublishing in Concertivo instantly removes content from endpoint responses.",
          ],
        },
        {
          heading: "8. Troubleshooting",
          bullets: [
            "404 / empty response — verify the slug and that „Published” is on.",
            "CORS error — add the website domain in the Integration tab.",
            "Stale data — endpoints set Cache-Control max-age=60, check your CDN/browser cache.",
            "Missing images — files come from our R2 CDN; allow *.concertivo.eu in your CSP.",
          ],
        },
      ],
      footer: "Questions? Contact the platform administrator (i-Future) or see https://concertivo.eu/docs.",
    },
  },
  webhooks: {
    pl: {
      title: "Concertivo — Webhooki dla strony WWW",
      subtitle: "Instrukcja techniczna odbioru zdarzeń po stronie webmastera",
      intro: [
        "Webhooki to powiadomienia HTTP wysyłane przez Concertivo do Twojego serwera w momencie, gdy w aplikacji wydarzy się coś ważnego (publikacja aktualności, zmiana wydarzenia, dodanie zdjęć do galerii). Pozwalają od razu odświeżyć cache strony, zbudować statyczny build (SSG) albo wysłać newsletter — bez odpytywania endpointów co minutę.",
        "Concertivo wysyła POST z ciałem JSON i podpisem HMAC-SHA256 w nagłówku „X-Concertivo-Signature”. Twoim zadaniem jest wystawić publiczny endpoint, zweryfikować podpis i zareagować na zdarzenie.",
      ],
      sections: [
        {
          heading: "1. Wymagania techniczne po stronie strony WWW",
          bullets: [
            "Publiczny adres HTTPS (TLS wymagany) — np. https://example.com/api/concertivo-hook.",
            "Serwer odpowiadający kodem 2xx w czasie < 10 sekund. Każda inna odpowiedź = retry (do 5 prób z backoff).",
            "Możliwość obliczenia HMAC-SHA256 (Node.js: crypto, PHP: hash_hmac, Python: hmac, .NET: HMACSHA256).",
            "Endpoint MUSI być idempotentny — to samo zdarzenie może przyjść więcej niż raz (pole „id” w payloadzie pomaga w deduplikacji).",
          ],
        },
        {
          heading: "2. Konfiguracja w Concertivo",
          bullets: [
            "Moduł Web -> Webhooki -> „Dodaj”.",
            "Wpisz nazwę (np. „WordPress cache flush”) i URL endpointu.",
            "Wybierz zdarzenia (możesz zaznaczyć wszystkie — Twoja strona zignoruje nieobsługiwane).",
            "Po zapisie Concertivo pokaże jednorazowo „Secret” — zapisz go w bezpiecznym miejscu (kopia poprzez przycisk „Pokaż sekret” jest dostępna w panelu).",
            "Sekretu używasz po stronie serwera do weryfikacji podpisu — NIGDY nie umieszczaj go w kodzie frontendowym.",
          ],
        },
        {
          heading: "3. Lista dostępnych zdarzeń",
          code: [
            "web.news.published       — publikacja nowej aktualności",
            "web.news.updated         — edycja aktualności",
            "web.news.unpublished     — cofnięcie publikacji",
            "web.events.published     — publikacja wydarzenia",
            "web.events.updated       — edycja wydarzenia",
            "web.events.unpublished   — cofnięcie publikacji",
            "web.gallery.published    — publikacja albumu / zdjęć",
            "web.gallery.updated      — edycja galerii",
            "web.gallery.unpublished  — cofnięcie publikacji",
          ].join("\n"),
        },
        {
          heading: "4. Format żądania (request)",
          paragraphs: [
            "Concertivo wysyła żądanie HTTP POST z nagłówkami i ciałem w formacie JSON:",
          ],
          code:
            "POST /api/concertivo-hook HTTP/1.1\n" +
            "Content-Type: application/json\n" +
            "X-Concertivo-Event: web.news.published\n" +
            "X-Concertivo-Delivery: 9b8a2c5d-...     (unikalne ID dostawy)\n" +
            "X-Concertivo-Timestamp: 1736601234       (unix epoch w sekundach)\n" +
            "X-Concertivo-Signature: sha256=<HMAC>    (podpis ciała)\n" +
            "\n" +
            "{\n" +
            '  "id": "evt_01H...",\n' +
            '  "event": "web.news.published",\n' +
            '  "org_slug": "filharmonia-szczecinska",\n' +
            '  "timestamp": 1736601234,\n' +
            '  "data": { /* zależne od typu zdarzenia */ }\n' +
            "}",
        },
        {
          heading: "5. Weryfikacja podpisu (KRYTYCZNE)",
          paragraphs: [
            "Bez weryfikacji podpisu każdy w internecie może podszyć się pod Concertivo. Algorytm: HMAC-SHA256 z sekretem webhooka, na surowym ciele żądania (raw body, dokładnie te bajty co przyszły — nie po JSON.parse).",
          ],
          code:
            "// Node.js / Express\n" +
            "import crypto from 'crypto';\n" +
            "app.post('/api/concertivo-hook',\n" +
            "  express.raw({ type: 'application/json' }),\n" +
            "  (req, res) => {\n" +
            "    const sig = req.header('X-Concertivo-Signature') || '';\n" +
            "    const expected = 'sha256=' + crypto\n" +
            "      .createHmac('sha256', process.env.CONCERTIVO_SECRET)\n" +
            "      .update(req.body).digest('hex');\n" +
            "    if (!crypto.timingSafeEqual(\n" +
            "        Buffer.from(sig), Buffer.from(expected))) {\n" +
            "      return res.status(401).send('bad signature');\n" +
            "    }\n" +
            "    const payload = JSON.parse(req.body.toString('utf8'));\n" +
            "    // ... obsługa zdarzenia\n" +
            "    res.status(200).send('ok');\n" +
            "  }\n" +
            ");",
        },
        {
          heading: "6. Przykład PHP (WordPress / czysty PHP)",
          code:
            "<?php\n" +
            "$raw = file_get_contents('php://input');\n" +
            "$sig = $_SERVER['HTTP_X_CONCERTIVO_SIGNATURE'] ?? '';\n" +
            "$expected = 'sha256=' . hash_hmac('sha256', $raw, getenv('CONCERTIVO_SECRET'));\n" +
            "if (!hash_equals($expected, $sig)) {\n" +
            "  http_response_code(401); exit('bad signature');\n" +
            "}\n" +
            "$payload = json_decode($raw, true);\n" +
            "switch ($payload['event']) {\n" +
            "  case 'web.news.published':\n" +
            "    // np. wp_cache_flush(); albo wywołaj webhook do ISR\n" +
            "    break;\n" +
            "}\n" +
            "http_response_code(200); echo 'ok';",
        },
        {
          heading: "7. Polityka ponowień (retry)",
          bullets: [
            "Jeśli Twój endpoint zwróci kod inny niż 2xx lub przekroczy 10 s, Concertivo ponawia próbę.",
            "Maksymalnie 5 prób z rosnącym opóźnieniem (30 s, 2 min, 10 min, 1 h, 6 h).",
            "Po wyczerpaniu prób dostawa trafia do logu „Dostawy” (ikona aktywności przy webhooku) z błędem.",
            "Możesz w każdej chwili zobaczyć ostatnie dostawy, kody odpowiedzi i czas reakcji.",
          ],
        },
        {
          heading: "8. Zalecane praktyki",
          bullets: [
            "Zwracaj 200 OK natychmiast, ciężką pracę (przebudowa strony, wysyłka newslettera) wrzuć w kolejkę (np. Redis/SQS/cron).",
            "Loguj nagłówek X-Concertivo-Delivery — pomaga w debugowaniu duplikatów.",
            "Trzymaj sekret w zmiennej środowiskowej, nie w repozytorium.",
            "Po rotacji sekretu (przycisk w panelu) zaktualizuj wartość po stronie serwera — stary sekret przestaje działać natychmiast.",
            "Dla statycznych stron (Next.js / Gatsby / Astro) najprościej trigger-ować rebuild w Vercel/Netlify/CF Pages — wystarczy proxy odbierające webhook i wywołujące deploy hook po weryfikacji podpisu.",
          ],
        },
      ],
      footer: "Pomoc techniczna: administrator platformy (i-Future) lub https://concertivo.eu/docs.",
    },
    en: {
      title: "Concertivo — Webhooks for your website",
      subtitle: "Technical guide for receiving events on the webmaster side",
      intro: [
        "Webhooks are HTTP notifications that Concertivo sends to your server whenever something important happens (news published, event changed, gallery updated). They let you invalidate caches, trigger SSG rebuilds or send newsletters in real time — no polling required.",
        "Concertivo sends POST with a JSON body and an HMAC-SHA256 signature in the „X-Concertivo-Signature” header. Your job is to expose a public endpoint, verify the signature, and react to the event.",
      ],
      sections: [
        {
          heading: "1. Requirements",
          bullets: [
            "Public HTTPS URL — e.g. https://example.com/api/concertivo-hook.",
            "Endpoint must respond 2xx within 10 seconds. Otherwise we retry (up to 5 attempts with backoff).",
            "Ability to compute HMAC-SHA256 (Node crypto, PHP hash_hmac, Python hmac, .NET HMACSHA256).",
            "Idempotent handler — the same delivery can arrive more than once (use the „id” field for deduplication).",
          ],
        },
        {
          heading: "2. Setup in Concertivo",
          bullets: [
            "Web module -> Webhooks -> Add.",
            "Provide a name (e.g. „WordPress cache flush”) and target URL.",
            "Pick events (you can select all — your endpoint will ignore unknown ones).",
            "After saving Concertivo shows the secret once — store it safely (you can reveal it again with „Show secret”).",
            "Use the secret server-side ONLY — never expose it in browser code.",
          ],
        },
        {
          heading: "3. Available events",
          code: [
            "web.news.published / .updated / .unpublished",
            "web.events.published / .updated / .unpublished",
            "web.gallery.published / .updated / .unpublished",
          ].join("\n"),
        },
        {
          heading: "4. Request format",
          code:
            "POST /api/concertivo-hook HTTP/1.1\n" +
            "Content-Type: application/json\n" +
            "X-Concertivo-Event: web.news.published\n" +
            "X-Concertivo-Delivery: 9b8a2c5d-...\n" +
            "X-Concertivo-Timestamp: 1736601234\n" +
            "X-Concertivo-Signature: sha256=<HMAC>\n" +
            "\n" +
            "{ \"id\": \"evt_...\", \"event\": \"...\", \"org_slug\": \"...\",\n" +
            "  \"timestamp\": 1736601234, \"data\": { ... } }",
        },
        {
          heading: "5. Signature verification (CRITICAL)",
          paragraphs: [
            "Without verification anyone can impersonate Concertivo. Algorithm: HMAC-SHA256 with the webhook secret, on the raw request body (exact bytes received).",
          ],
          code:
            "// Node.js / Express\n" +
            "import crypto from 'crypto';\n" +
            "app.post('/api/concertivo-hook',\n" +
            "  express.raw({ type: 'application/json' }),\n" +
            "  (req, res) => {\n" +
            "    const sig = req.header('X-Concertivo-Signature') || '';\n" +
            "    const expected = 'sha256=' + crypto\n" +
            "      .createHmac('sha256', process.env.CONCERTIVO_SECRET)\n" +
            "      .update(req.body).digest('hex');\n" +
            "    if (!crypto.timingSafeEqual(\n" +
            "        Buffer.from(sig), Buffer.from(expected)))\n" +
            "      return res.status(401).send('bad signature');\n" +
            "    const payload = JSON.parse(req.body.toString('utf8'));\n" +
            "    res.status(200).send('ok');\n" +
            "  });",
        },
        {
          heading: "6. PHP example",
          code:
            "<?php\n" +
            "$raw = file_get_contents('php://input');\n" +
            "$sig = $_SERVER['HTTP_X_CONCERTIVO_SIGNATURE'] ?? '';\n" +
            "$expected = 'sha256=' . hash_hmac('sha256', $raw, getenv('CONCERTIVO_SECRET'));\n" +
            "if (!hash_equals($expected, $sig)) { http_response_code(401); exit; }\n" +
            "$payload = json_decode($raw, true);\n" +
            "http_response_code(200);",
        },
        {
          heading: "7. Retry policy",
          bullets: [
            "Non-2xx or > 10 s response triggers retry.",
            "Up to 5 attempts with backoff: 30 s, 2 min, 10 min, 1 h, 6 h.",
            "After exhausting retries the delivery is recorded as failed in the dashboard.",
          ],
        },
        {
          heading: "8. Best practices",
          bullets: [
            "Return 200 immediately, push heavy work to a queue.",
            "Log X-Concertivo-Delivery for debugging duplicates.",
            "Keep the secret in env vars, never in the repo.",
            "Rotate secret in Concertivo and update server-side immediately — old secret stops working.",
            "For static sites (Next/Gatsby/Astro) the webhook can call a Vercel/Netlify deploy hook to rebuild.",
          ],
        },
      ],
      footer: "Support: platform administrator (i-Future) or https://concertivo.eu/docs.",
    },
  },
};

export function downloadIntegrationGuidePdf(
  kind: "integration" | "webhooks",
  lang: Lang,
): void {
  const guide = GUIDES[kind][lang] ?? GUIDES[kind].pl;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN_X = 48;
  const MARGIN_Y = 56;
  const MAX_W = PAGE_W - MARGIN_X * 2;
  let y = MARGIN_Y;

  // Strip non-WinAnsi characters that jsPDF default font cannot render
  // (jsPDF built-in Helvetica handles only Latin-1; PL diacritics become "?" boxes).
  const ascii = (s: string): string =>
    s
      .replace(/[ąĄ]/g, (c) => (c === "ą" ? "a" : "A"))
      .replace(/[ćĆ]/g, (c) => (c === "ć" ? "c" : "C"))
      .replace(/[ęĘ]/g, (c) => (c === "ę" ? "e" : "E"))
      .replace(/[łŁ]/g, (c) => (c === "ł" ? "l" : "L"))
      .replace(/[ńŃ]/g, (c) => (c === "ń" ? "n" : "N"))
      .replace(/[óÓ]/g, (c) => (c === "ó" ? "o" : "O"))
      .replace(/[śŚ]/g, (c) => (c === "ś" ? "s" : "S"))
      .replace(/[żŻźŹ]/g, (c) => (c === "ż" || c === "ź" ? "z" : "Z"))
      .replace(/[„”]/g, '"')
      .replace(/[‚’]/g, "'")
      .replace(/[—–]/g, "-")
      .replace(/…/g, "...");

  function ensure(spaceNeeded: number) {
    if (y + spaceNeeded > PAGE_H - MARGIN_Y) {
      doc.addPage();
      y = MARGIN_Y;
    }
  }

  function writeWrapped(text: string, size: number, opts: { bold?: boolean; mono?: boolean; color?: [number, number, number]; lineGap?: number } = {}) {
    doc.setFont(opts.mono ? "courier" : "helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(ascii(text), MAX_W) as string[];
    const lh = size * 1.35 + (opts.lineGap ?? 0);
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN_X, y);
      y += lh;
    }
  }

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(ascii(guide.title), MARGIN_X, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(ascii(guide.subtitle), MARGIN_X, 68);
  y = 120;

  // Intro
  for (const p of guide.intro) {
    writeWrapped(p, 11, { lineGap: 2 });
    y += 6;
  }

  // Sections
  for (const sec of guide.sections) {
    y += 8;
    ensure(28);
    writeWrapped(sec.heading, 13, { bold: true, color: [15, 23, 42] });
    if (sec.paragraphs) for (const p of sec.paragraphs) writeWrapped(p, 11);
    if (sec.bullets) {
      for (const b of sec.bullets) {
        const lh = 11 * 1.35;
        const text = "• " + b;
        const lines = doc.splitTextToSize(ascii(text), MAX_W - 12) as string[];
        for (const line of lines) {
          ensure(lh);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(40, 40, 40);
          doc.text(line, MARGIN_X + 8, y);
          y += lh;
        }
      }
    }
    if (sec.code) {
      const padding = 8;
      const codeLines = doc.splitTextToSize(ascii(sec.code), MAX_W - padding * 2) as string[];
      const lh = 9 * 1.4;
      const boxH = codeLines.length * lh + padding * 2;
      ensure(boxH + 6);
      const startY = y;
      doc.setFillColor(245, 246, 250);
      doc.setDrawColor(220, 224, 232);
      doc.roundedRect(MARGIN_X, startY, MAX_W, boxH, 4, 4, "FD");
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      let cy = startY + padding + 9;
      for (const line of codeLines) {
        doc.text(line, MARGIN_X + padding, cy);
        cy += lh;
      }
      y = startY + boxH + 6;
    }
  }

  // Footer note
  y += 16;
  writeWrapped(guide.footer, 10, { color: [90, 90, 90] });

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(`Concertivo  ·  ${i} / ${total}`, PAGE_W - MARGIN_X, PAGE_H - 24, { align: "right" });
  }

  const fname =
    kind === "integration"
      ? `concertivo-integracja-www-${lang}.pdf`
      : `concertivo-webhooki-${lang}.pdf`;
  doc.save(fname);
}
