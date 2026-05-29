// OAuth 2.0 callback dla X (Twitter). Wywoływane przez X po autoryzacji.
// Stały URL: ${origin}/api/public/social/x-callback (wpisywany w developer.x.com).
import { createFileRoute } from "@tanstack/react-router";
import { handleXOAuthCallback } from "@/lib/social-oauth.server";

function html(title: string, body: string, ok: boolean, redirectTo?: string): Response {
  const color = ok ? "#059669" : "#dc2626";
  const meta = redirectTo
    ? `<meta http-equiv="refresh" content="3;url=${redirectTo}">`
    : "";
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8">${meta}<title>${title}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;line-height:1.5;color:#0f172a}h1{color:${color};margin:0 0 16px}a.btn{display:inline-block;margin-top:16px;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px}</style></head>
<body><h1>${title}</h1><div>${body}</div>${redirectTo ? `<a class="btn" href="${redirectTo}">Wróć do aplikacji</a>` : ""}</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/social/x-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (errorParam) {
          return html(
            "Autoryzacja anulowana",
            `<p>X zwrócił błąd: <b>${errorParam}</b></p><p>${errorDesc ?? ""}</p>`,
            false,
          );
        }
        if (!code || !state) {
          return html("Błąd autoryzacji", "<p>Brak parametrów <code>code</code> lub <code>state</code>.</p>", false);
        }

        const callbackUrl = `${url.origin}/api/public/social/x-callback`;
        try {
          const res = await handleXOAuthCallback({ code, state, callbackUrl });
          const back = res.redirectBack ?? `/organizations/${res.orgId}/social`;
          return html(
            "Połączono z X (Twitter)",
            `<p>Konto <b>${res.accountName}</b> zostało powiązane z Twoją organizacją.</p><p>Za chwilę wrócisz do aplikacji…</p>`,
            true,
            back,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Nieznany błąd";
          console.error("[x-callback]", msg);
          return html("Błąd podczas łączenia z X", `<p>${msg}</p>`, false);
        }
      },
    },
  },
});
