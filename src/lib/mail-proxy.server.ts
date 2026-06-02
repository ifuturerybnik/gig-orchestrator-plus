// SERVER-ONLY. Wrapper do mail-proxy (https://mail.concertivo.eu).
// Wywołuje endpointy POST /sync, /body-sync, /body, /send, /mark z nagłówkiem
// X-Proxy-Token. Sama definicja proxy: vps/mail-proxy-concertivo/ + CRM Hub proxy/src/main.ts.

type ProxyEndpoint = "sync" | "body-sync" | "body" | "send" | "mark";

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeSendPayload(body: Record<string, unknown>): Record<string, unknown> {
  const html = body.html ?? body.body_html ?? body.bodyHtml;
  const text = body.text ?? body.body_text ?? body.bodyText;
  const normalized = { ...body };

  if (typeof html === "string" && html.trim()) {
    normalized.html = html;
    normalized.body_html = html;
    normalized.bodyHtml = html;
  }

  if (typeof text === "string" && text.trim()) {
    normalized.text = text;
    normalized.body_text = text;
    normalized.bodyText = text;
  } else if (typeof html === "string" && html.trim()) {
    const plain = stripHtmlToText(html);
    normalized.text = plain;
    normalized.body_text = plain;
    normalized.bodyText = plain;
  }

  return normalized;
}

async function tokenFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getBase(): string {
  const url = process.env.MAIL_PROXY_URL;
  if (!url) throw new Error("Missing MAIL_PROXY_URL");
  return url.replace(/\/+$/, "");
}

function getToken(): string {
  const token = (process.env.MAIL_PROXY_TOKEN ?? "")
    .trim()
    .replace(/^\s*(?:MAIL_PROXY_TOKEN|PROXY_TOKEN)\s*=\s*/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!token) throw new Error("Missing MAIL_PROXY_TOKEN");
  return token;
}

function proxyAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "X-Proxy-Token": token,
    Authorization: `Bearer ${token}`,
  };
}

export async function callMailProxy<T = unknown>(
  endpoint: ProxyEndpoint,
  body: Record<string, unknown> = {},
): Promise<T> {
  const base = getBase();
  const token = getToken();
  const payload = endpoint === "send" ? normalizeSendPayload(body) : body;
  const res = await fetch(`${getBase()}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Token": token,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    console.error("Mail proxy request failed", {
      endpoint,
      base,
      status: res.status,
      tokenLength: token.length,
      tokenSha256Prefix: await tokenFingerprint(token),
      body: parsed,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Mail proxy odrzucił autoryzację. Sprawdź sekret MAIL_PROXY_TOKEN oraz konfigurację proxy na VPS.",
      );
    }

    const msg =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Mail proxy ${endpoint} failed (${res.status})`;
    throw new Error(msg);
  }
  return parsed as T;
}

export async function mailProxyHealth(): Promise<{ status: string; time: string }> {
  const res = await fetch(`${getBase()}/health`, {
    headers: proxyAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Mail proxy health failed (${res.status})`);
  return res.json() as Promise<{ status: string; time: string }>;
}
