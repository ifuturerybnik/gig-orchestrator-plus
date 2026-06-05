// OAuth 2.0 callback dla Meta (Facebook + Instagram).
// Stały URL: ${origin}/api/public/social/meta-callback
// Jeden flow zwraca długoterminowy page token i listę stron;
// zapisujemy konto Facebook i (jeśli powiązane) Instagram.
import { createFileRoute } from "@tanstack/react-router";
import { handleMetaOAuthCallback, type MetaDiagnostics } from "@/lib/social-oauth.server";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function renderDiagnostics(d: MetaDiagnostics | null | undefined): string {
  if (!d) return "";
  const grantedHtml = d.granted.length
    ? d.granted.map((p) => `<span class="chip chip-ok">${esc(p)}</span>`).join("")
    : '<span class="muted">— brak —</span>';
  const declinedHtml = d.declined.length
    ? d.declined.map((p) => `<span class="chip chip-bad">${esc(p)}</span>`).join("")
    : '<span class="muted">— brak —</span>';

  const pagesRows = d.pages.length
    ? d.pages.map((p) => `
        <tr${p.selected ? ' class="sel"' : ''}>
          <td>${p.selected ? "★ " : ""}<b>${esc(p.name)}</b><br><span class="muted">ID: ${esc(p.id)}</span></td>
          <td>${p.businessName ? `${esc(p.businessName)}<br><span class="muted">${esc(p.businessId ?? "")}</span>` : '<span class="muted">— brak BM —</span>'}</td>
          <td>${p.hasInstagram ? `@${esc(p.instagramUsername ?? "")}` : '<span class="muted">—</span>'}</td>
          <td><span class="muted">${esc((p.tasks ?? []).join(", ") || "—")}</span></td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="muted">Meta nie zwróciła żadnej strony.</td></tr>`;

  return `
    <h2>Diagnostyka Meta</h2>
    <h3>Uprawnienia przyznane</h3>
    <div class="chips">${grantedHtml}</div>
    <h3>Uprawnienia odrzucone</h3>
    <div class="chips">${declinedHtml}</div>
    <h3>Strony dostępne dla tego konta</h3>
    <table>
      <thead><tr><th>Strona</th><th>Business Manager</th><th>Instagram</th><th>Tasks (uprawnienia na stronie)</th></tr></thead>
      <tbody>${pagesRows}</tbody>
    </table>
    <p class="muted">★ = strona wybrana i zapisana w Concertivo. Aby zmienić wybór — odłącz konto i połącz ponownie zaznaczając właściwą stronę w oknie autoryzacji Meta.</p>
  `;
}

function html(
  title: string,
  body: string,
  ok: boolean,
  redirectTo?: string,
  diagnostics?: MetaDiagnostics | null,
): Response {
  const color = ok ? "#059669" : "#dc2626";
  // Auto-redirect wyłączony gdy są diagnostyki — użytkownik musi je przeczytać.
  const showAutoRedirect = ok && !diagnostics;
  const meta = showAutoRedirect && redirectTo ? `<meta http-equiv="refresh" content="3;url=${redirectTo}">` : "";
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8">${meta}<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:860px;margin:40px auto;padding:24px;line-height:1.5;color:#0f172a}
  h1{color:${color};margin:0 0 16px}
  h2{margin-top:32px;font-size:18px;border-top:1px solid #e2e8f0;padding-top:24px}
  h3{margin-top:20px;font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#64748b}
  a.btn{display:inline-block;margin-top:24px;padding:10px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-family:ui-monospace,monospace}
  .chip-ok{background:#dcfce7;color:#166534}
  .chip-bad{background:#fee2e2;color:#991b1b}
  .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{background:#f8fafc;font-weight:600;font-size:12px;text-transform:uppercase;color:#475569}
  tr.sel{background:#fef9c3}
</style></head>
<body>
  <h1>${title}</h1>
  <div>${body}</div>
  ${renderDiagnostics(diagnostics)}
  ${redirectTo ? `<a class="btn" href="${redirectTo}">Wróć do aplikacji</a>` : ""}
</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/social/meta-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error_reason");

        if (errorParam) {
          return html(
            "Autoryzacja anulowana",
            `<p>Meta zwrócił błąd: <b>${errorParam}</b></p><p>${errorDesc ?? ""}</p>`,
            false,
          );
        }
        if (!code || !state) {
          return html(
            "Błąd autoryzacji",
            `<p id="oauth-message">Brak parametrów <code>code</code> lub <code>state</code>. Uruchom integrację ponownie z aplikacji.</p>
             <script>
               const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
               const err = hash.get("error") || hash.get("error_reason");
               const desc = hash.get("error_description");
               if (err || desc) {
                 const el = document.getElementById("oauth-message");
                 el.textContent = "Meta zwrócił błąd autoryzacji: " + (err || "error") + (desc ? " — " + desc : "");
               }
             </script>`,
            false,
          );
        }
        const xfHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
        const xfProto =
          request.headers.get("x-forwarded-proto") ??
          (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(xfHost) ? "http" : "https");
        const callbackUrl = `${xfProto}://${xfHost}/api/public/social/meta-callback`;
        try {
          const res = await handleMetaOAuthCallback({ code, state, callbackUrl });
          const back = res.redirectBack ?? `/organizations/${res.orgId}/social`;
          const names = [
            res.facebookPageName ? `Facebook: <b>${res.facebookPageName}</b>` : null,
            res.instagramUsername ? `Instagram: <b>@${res.instagramUsername}</b>` : null,
          ]
            .filter(Boolean)
            .join("<br>");
          return html(
            "Połączono z Meta",
            `<p>Powiązano konta:</p><p>${names}</p>`,
            true,
            back,
            res.diagnostics,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Nieznany błąd";
          const diag = (e as Error & { diagnostics?: MetaDiagnostics }).diagnostics ?? null;
          console.error("[meta-callback]", msg);
          return html("Błąd podczas łączenia z Meta", `<p>${esc(msg)}</p>`, false, undefined, diag);
        }
      },
    },
  },
});
