// OAuth 2.0 callback dla Instagram Login API.
// Stały URL: ${origin}/api/public/social/instagram-callback
import { createFileRoute } from "@tanstack/react-router";
import { handleMetaOAuthCallback } from "@/lib/social-oauth.server";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function html(title: string, body: string, ok: boolean, redirectTo?: string): Response {
  const color = ok ? "#059669" : "#dc2626";
  const meta = ok && redirectTo ? `<meta http-equiv="refresh" content="3;url=${redirectTo}">` : "";
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8">${meta}<title>${esc(title)}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:80px auto;padding:24px;line-height:1.5;color:#0f172a}h1{color:${color};margin:0 0 16px}a.btn{display:inline-block;margin-top:16px;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px}</style></head>
<body><h1>${esc(title)}</h1><div>${body}</div>${redirectTo ? `<a class="btn" href="${redirectTo}">Wróć do aplikacji</a>` : ""}</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/social/instagram-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description") ?? url.searchParams.get("error_reason");
        if (errorParam) return html("Autoryzacja anulowana", `<p>Instagram zwrócił błąd: <b>${esc(errorParam)}</b></p><p>${esc(errorDesc ?? "")}</p>`, false);
        if (!code || !state) return html("Błąd autoryzacji", "<p>Brak parametrów <code>code</code> lub <code>state</code>.</p>", false);

        const xfHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
        const xfProto = request.headers.get("x-forwarded-proto") ?? (/^(localhost|127\.|0\.|\[?::1\]?)/i.test(xfHost) ? "http" : "https");
        const callbackUrl = `${xfProto}://${xfHost}/api/public/social/instagram-callback`;
        try {
          const res = await handleMetaOAuthCallback({ code, state, callbackUrl });
          const back = res.redirectBack ?? `/organizations/${res.orgId}/social`;
          return html("Połączono z Instagram", `<p>Konto <b>@${esc(res.instagramUsername ?? "Instagram")}</b> zostało powiązane z organizacją.</p>`, true, back);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Nieznany błąd";
          console.error("[instagram-callback]", msg);
          return html("Błąd podczas łączenia z Instagram", `<p>${esc(msg)}</p>`, false);
        }
      },
    },
  },
});