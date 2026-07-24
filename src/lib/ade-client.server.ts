// Server-only ADE (e-Doręczenia) API client using mTLS with QWAC certificate.
// Runs on the VPS Node runtime; imports node:https and node:fs dynamically.

export type AdeConfig = {
  apiBase: string;
  clientId: string;
  mailboxAddress: string;
  certPath: string;
  keyPath: string;
  keyPassphrase?: string;
};

export function loadAdeConfig(): AdeConfig {
  const {
    ADE_API_BASE,
    ADE_CLIENT_ID,
    ADE_MAILBOX_ADDRESS,
    ADE_QWAC_CERT_PATH,
    ADE_QWAC_KEY_PATH,
    ADE_QWAC_KEY_PASSPHRASE,
  } = process.env;
  if (!ADE_API_BASE) throw new Error("Brak ADE_API_BASE w env");
  if (!ADE_CLIENT_ID) throw new Error("Brak ADE_CLIENT_ID w env");
  if (!ADE_MAILBOX_ADDRESS) throw new Error("Brak ADE_MAILBOX_ADDRESS w env");
  if (!ADE_QWAC_CERT_PATH) throw new Error("Brak ADE_QWAC_CERT_PATH w env");
  if (!ADE_QWAC_KEY_PATH) throw new Error("Brak ADE_QWAC_KEY_PATH w env");
  return {
    apiBase: ADE_API_BASE.replace(/\/+$/, ""),
    clientId: ADE_CLIENT_ID,
    mailboxAddress: ADE_MAILBOX_ADDRESS,
    certPath: ADE_QWAC_CERT_PATH,
    keyPath: ADE_QWAC_KEY_PATH,
    keyPassphrase: ADE_QWAC_KEY_PASSPHRASE,
  };
}

export type AdeRawResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  tlsPeerSubject?: string;
  tlsPeerIssuer?: string;
};

/** Perform an HTTPS request to ADE with client-certificate authentication (mTLS). */
export async function adeRawRequest(opts: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<AdeRawResponse> {
  const cfg = loadAdeConfig();
  const https = await import("node:https");
  const fs = await import("node:fs");

  const cert = fs.readFileSync(cfg.certPath);
  const key = fs.readFileSync(cfg.keyPath);
  const url = new URL(cfg.apiBase + opts.path);

  return await new Promise<AdeRawResponse>((resolvePromise, rejectPromise) => {
    const req = https.request(
      {
        method: opts.method,
        host: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        cert,
        key,
        passphrase: cfg.keyPassphrase,
        headers: {
          Accept: "application/json",
          ...opts.headers,
        },
        timeout: opts.timeoutMs ?? 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const socket = res.socket as unknown as {
            getPeerCertificate?: () => {
              subject?: { CN?: string; O?: string };
              issuer?: { CN?: string; O?: string };
            };
          };
          const peer = socket.getPeerCertificate?.();
          resolvePromise({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]),
            ),
            body: Buffer.concat(chunks).toString("utf8"),
            tlsPeerSubject: peer?.subject ? `${peer.subject.CN ?? ""} (${peer.subject.O ?? ""})` : undefined,
            tlsPeerIssuer: peer?.issuer ? `${peer.issuer.CN ?? ""} (${peer.issuer.O ?? ""})` : undefined,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Timeout połączenia z ADE"));
    });
    req.on("error", (err) => rejectPromise(err));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Attempt OAuth2 client_credentials token fetch. Endpoint path may vary — configurable via ADE_TOKEN_PATH. */
export async function fetchAdeToken(): Promise<AdeRawResponse> {
  const cfg = loadAdeConfig();
  const tokenPath = process.env.ADE_TOKEN_PATH || "/oauth2/token";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    scope: "ade",
  });
  return adeRawRequest({
    method: "POST",
    path: tokenPath,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}
