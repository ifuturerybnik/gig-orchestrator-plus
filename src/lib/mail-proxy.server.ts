// SERVER-ONLY. Wrapper do mail-proxy (https://mail.concertivo.eu).
// Wywołuje endpointy POST /sync, /body-sync, /body, /send, /mark z nagłówkiem
// X-Proxy-Token. Sama definicja proxy: vps/mail-proxy-concertivo/ + CRM Hub proxy/src/main.ts.

type ProxyEndpoint = "sync" | "body-sync" | "body" | "send" | "mark";

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
  const res = await fetch(`${getBase()}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...proxyAuthHeaders(),
    },
    body: JSON.stringify(body),
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
      status: res.status,
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
