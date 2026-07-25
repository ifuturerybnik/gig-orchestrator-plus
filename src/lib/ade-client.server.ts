// Server-only ADE (e-Doręczenia) API client using mTLS with QWAC certificate.
// Runs on the VPS Node runtime; imports node:https, node:fs, node:crypto dynamically.
//
// Uwierzytelnianie tokenowe: e-Doręczenia wymagają `private_key_jwt`
// (RFC 7523) — klient podpisuje krótki JWT kluczem prywatnym QWAC i
// wysyła jako `client_assertion` do endpointu tokenowego Keycloaka
// (KSDE / moduł uprawnień). Nie ma `client_secret`.

export type AdeConfig = {
  apiBase: string;        // UA API (mTLS) — np. https://uaapi-ow.poczta-polska.pl
  oauthBase: string;      // Keycloak KSDE — np. https://ow.edoreczenia.gov.pl
  tokenPath: string;      // np. /auth/realms/EDOR/protocol/openid-connect/token
  clientId: string;
  mailboxAddress: string;
  certPath: string;
  keyPath: string;
  keyPassphrase?: string;
};

const DEFAULT_TOKEN_PATH = "/auth/realms/EDOR/protocol/openid-connect/token";

function envDefaults(env: string | undefined) {
  // env=prod|int — pozwala łatwo przełączyć środowisko
  const isInt = (env ?? "").toLowerCase() === "int";
  return {
    apiBase: isInt
      ? "https://uaapi-int-ow.poczta-polska.pl"
      : "https://uaapi-ow.poczta-polska.pl",
    oauthBase: isInt
      ? "https://int-ow.edoreczenia.gov.pl"
      : "https://ow.edoreczenia.gov.pl",
  };
}

export function loadAdeConfig(): AdeConfig {
  const {
    ADE_ENV,
    ADE_API_BASE,
    ADE_OAUTH_BASE,
    ADE_TOKEN_PATH,
    ADE_CLIENT_ID,
    ADE_MAILBOX_ADDRESS,
    ADE_QWAC_CERT_PATH,
    ADE_QWAC_KEY_PATH,
    ADE_QWAC_KEY_PASSPHRASE,
  } = process.env;
  const defaults = envDefaults(ADE_ENV);
  if (!ADE_CLIENT_ID) throw new Error("Brak ADE_CLIENT_ID w env");
  if (!ADE_MAILBOX_ADDRESS) throw new Error("Brak ADE_MAILBOX_ADDRESS w env");
  if (!ADE_QWAC_CERT_PATH) throw new Error("Brak ADE_QWAC_CERT_PATH w env");
  if (!ADE_QWAC_KEY_PATH) throw new Error("Brak ADE_QWAC_KEY_PATH w env");
  return {
    apiBase: (ADE_API_BASE || defaults.apiBase).replace(/\/+$/, ""),
    oauthBase: (ADE_OAUTH_BASE || defaults.oauthBase).replace(/\/+$/, ""),
    tokenPath: ADE_TOKEN_PATH || DEFAULT_TOKEN_PATH,
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
  bodyBuffer?: Buffer;
  tlsPeerSubject?: string;
  tlsPeerIssuer?: string;
};

type RawRequestOpts = {
  method: string;
  url: string;                        // pełny URL
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  useMtls?: boolean;                  // czy dołączać cert klienta
  binary?: boolean;                   // zwróć też bodyBuffer
};

async function httpsRawRequest(opts: RawRequestOpts): Promise<AdeRawResponse> {
  const https = await import("node:https");
  const fs = await import("node:fs");
  const cfg = loadAdeConfig();
  const url = new URL(opts.url);

  let cert: Buffer | undefined;
  let key: Buffer | undefined;
  if (opts.useMtls) {
    cert = fs.readFileSync(cfg.certPath);
    key = fs.readFileSync(cfg.keyPath);
  }

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
          const socket = res.socket as
            | ({
                getPeerCertificate?: () => {
                  subject?: { CN?: string; O?: string };
                  issuer?: { CN?: string; O?: string };
                };
              } & object)
            | null;
          const peer = typeof socket?.getPeerCertificate === "function" ? socket.getPeerCertificate() : undefined;
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
    req.on("timeout", () => req.destroy(new Error("Timeout połączenia z ADE")));
    req.on("error", (err) => rejectPromise(err));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** mTLS request do UA API (używa apiBase + path). */
export async function adeRawRequest(opts: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<AdeRawResponse> {
  const cfg = loadAdeConfig();
  return httpsRawRequest({
    method: opts.method,
    url: cfg.apiBase + opts.path,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    useMtls: true,
  });
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Zbuduj client_assertion (JWT) podpisany kluczem prywatnym QWAC. */
async function buildClientAssertion(): Promise<{ jwt: string; audience: string }> {
  const cfg = loadAdeConfig();
  const fs = await import("node:fs");
  const crypto = await import("node:crypto");

  const certPem = fs.readFileSync(cfg.certPath, "utf8");
  const keyPem = fs.readFileSync(cfg.keyPath, "utf8");

  // Wyciągnij ciało base64 certyfikatu (DER) dla nagłówka x5c
  const certBody = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  // UA API / KSDE oczekuje audience = realmu (bez ścieżki /protocol/openid-connect/token)
  const audience = `${cfg.oauthBase}/auth/realms/EDOR`;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", x5c: [certBody] };
  const payload = {
    iss: cfg.clientId,
    sub: cfg.clientId,
    aud: audience,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 60,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({
    key: keyPem,
    passphrase: cfg.keyPassphrase,
  });
  return { jwt: `${signingInput}.${base64url(signature)}`, audience };
}

/** OAuth2 token via private_key_jwt (bez client_secret). */
export async function fetchAdeToken(): Promise<AdeRawResponse & { audience: string }> {
  const cfg = loadAdeConfig();
  const { jwt, audience } = await buildClientAssertion();
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: jwt,
  });
  // Keycloak KSDE wymaga login_hint=ADE.<adres_skrzynki>, aby powiązać token z konkretną skrzynką ADE.
  const tokenUrl =
    cfg.oauthBase + cfg.tokenPath + `?login_hint=${encodeURIComponent(`ADE.${cfg.mailboxAddress}`)}`;
  const res = await httpsRawRequest({
    method: "POST",
    url: tokenUrl,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    useMtls: false,
  });
  return { ...res, audience };
}
