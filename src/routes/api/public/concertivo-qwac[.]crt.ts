// Publiczny endpoint udostępniający certyfikat QWAC Concertivo (część PUBLICZNA,
// bez klucza prywatnego). Użytkownik pobiera plik i wgrywa go w biznes.gov.pl
// podczas rejestracji Concertivo jako "system zewnętrzny" swojej skrzynki
// e-Doręczeń. Klucz prywatny NIGDY nie opuszcza serwera.
import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "node:fs";

export const Route = createFileRoute("/api/public/concertivo-qwac.crt")({
  server: {
    handlers: {
      GET: async () => {
        const certPath = process.env.ADE_QWAC_CERT_PATH;
        if (!certPath) {
          return new Response("QWAC certificate not configured on server", { status: 503 });
        }
        try {
          const pem = readFileSync(certPath, "utf8");
          return new Response(pem, {
            status: 200,
            headers: {
              "Content-Type": "application/x-pem-file",
              "Content-Disposition": 'attachment; filename="concertivo-qwac.crt"',
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch (e) {
          return new Response(`Cannot read QWAC certificate: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
