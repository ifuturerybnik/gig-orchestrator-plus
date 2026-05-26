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
  const token = process.env.MAIL_PROXY_TOKEN;
  if (!token) throw new Error("Missing MAIL_PROXY_TOKEN");
  return token;
}

export async function callMailProxy<T = unknown>(
  endpoint: ProxyEndpoint,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`${getBase()}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Proxy-Token": getToken(),
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
    headers: { "X-Proxy-Token": getToken() },
  });
  if (!res.ok) throw new Error(`Mail proxy health failed (${res.status})`);
  return res.json() as Promise<{ status: string; time: string }>;
}
