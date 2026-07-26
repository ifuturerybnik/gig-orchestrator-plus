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
  // env=prod|int — pozwala łatwo przełączyć środowisko.
  // UWAGA: od ~lipca 2026 Poczta Polska przeniosła moduł uprawnień (Keycloak KSDE)
  // pod ten sam host co UA API. Stary `ow.edoreczenia.gov.pl` przekierowuje 302
  // do statycznej strony informacyjnej — token endpoint już tam nie odpowiada.
  const isInt = (env ?? "").toLowerCase() === "int";
  const apiBase = isInt
    ? "https://uaapi-int-ow.poczta-polska.pl"
    : "https://uaapi-ow.poczta-polska.pl";
  return {
    apiBase,
    oauthBase: apiBase,
  };
}

// Alternatywny (poprzedni) host OAuth — używany tylko jako fallback, gdyby
// operator wyznaczony ponownie rozdzielił punkty końcowe.
function legacyOauthBase(env: string | undefined): string {
  const isInt = (env ?? "").toLowerCase() === "int";
  return isInt ? "https://int-ow.edoreczenia.gov.pl" : "https://ow.edoreczenia.gov.pl";
}
// Automatycznie przemapuj wycofany host OAuth (ow.edoreczenia.gov.pl) na aktualny
// (uaapi-ow.poczta-polska.pl) — nawet gdy jest zapisany w env lub w DB.
function normalizeOauthBase(base: string, env: string | undefined): string {
  const trimmed = base.replace(/\/+$/, "");
  const isLegacyProd = /https?:\/\/ow\.edoreczenia\.gov\.pl$/i.test(trimmed);
  const isLegacyInt = /https?:\/\/int-ow\.edoreczenia\.gov\.pl$/i.test(trimmed);
  if (isLegacyProd || isLegacyInt) return envDefaults(env).oauthBase;
  return trimmed;
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
    oauthBase: normalizeOauthBase(ADE_OAUTH_BASE || defaults.oauthBase, ADE_ENV),
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
  attempt?: string;
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
          const buffer = Buffer.concat(chunks);
          resolvePromise({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]),
            ),
            body: buffer.toString("utf8"),
            bodyBuffer: opts.binary ? buffer : undefined,
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
  binary?: boolean;
}): Promise<AdeRawResponse> {
  const cfg = loadAdeConfig();
  return httpsRawRequest({
    method: opts.method,
    url: cfg.apiBase + opts.path,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    useMtls: true,
    binary: opts.binary,
  });
}

/** SE API (Search Engine OW) — bearer token, bez mTLS.
 *  Base: ADE_SE_BASE lub oauthBase (np. https://ow.edoreczenia.gov.pl). */
export async function adeSeRawRequest(opts: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<AdeRawResponse> {
  const cfg = loadAdeConfig();
  const base = (process.env.ADE_SE_BASE || cfg.oauthBase).replace(/\/+$/, "");
  return httpsRawRequest({
    method: opts.method,
    url: base + opts.path,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    useMtls: false,
  });
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function realmAudienceFromBase(base: string): string {
  return `${base.replace(/\/+$/, "")}/auth/realms/EDOR`;
}

function audienceCandidates(base: string, env: string | undefined): string[] {
  const legacy = legacyOauthBase(env);
  return [
    // Wersja produkcyjnie przetestowana: token endpoint i `aud` na hoście OW.
    realmAudienceFromBase(legacy),
    realmAudienceFromBase(base),
    // Instrukcje KSDE pokazują `aud` z http:// — zostawiamy jako fallback.
    realmAudienceFromBase(legacy).replace(/^https:/i, "http:"),
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function loginHintCandidates(mailboxAddress: string): string[] {
  const trimmed = mailboxAddress.trim();
  const withPrefix = trimmed.startsWith("ADE.") ? trimmed : `ADE.${trimmed}`;
  return [withPrefix, trimmed].filter((value, index, values) => value && values.indexOf(value) === index);
}

type ClientAssertionVariant = {
  label: string;
  includeX5c: boolean;
  includeNbf: boolean;
};

const STABLE_CLIENT_ASSERTION_VARIANT: ClientAssertionVariant = {
  label: "jwt:a02-stable-x5c-nbf",
  includeX5c: true,
  includeNbf: true,
};

/** Zbuduj client_assertion (JWT) podpisany kluczem prywatnym QWAC. */
async function buildClientAssertion(
  audience?: string,
  variant: ClientAssertionVariant = STABLE_CLIENT_ASSERTION_VARIANT,
): Promise<{ jwt: string; audience: string; variantLabel: string }> {
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

  const resolvedAudience = audience ?? realmAudienceFromBase(cfg.oauthBase);
  const now = Math.floor(Date.now() / 1000);
  // KSDE/Keycloak bywa wrażliwy na minimalne różnice czasu między hostami.
  // Cofamy iat/nbf o minutę i dajemy zgodne z instrukcją okno ~10 min,
  // żeby token nie był odrzucony jako "not yet valid" przy drobnym skew NTP.
  const issuedAt = now - 60;
  const header: Record<string, string | string[]> = { alg: "RS256", typ: "JWT" };
  if (variant.includeX5c) header.x5c = [certBody];
  const payload: Record<string, string | number> = {
    iss: cfg.clientId,
    sub: cfg.clientId,
    aud: resolvedAudience,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: now + 600,
  };
  if (variant.includeNbf) payload.nbf = issuedAt;
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({
    key: keyPem,
    passphrase: cfg.keyPassphrase,
  });
  return { jwt: `${signingInput}.${base64url(signature)}`, audience: resolvedAudience, variantLabel: variant.label };
}

/** OAuth2 token via private_key_jwt (bez client_secret). Token endpoint wymaga mTLS. */
export async function fetchAdeToken(): Promise<AdeRawResponse & { audience: string }> {
  const cfg = loadAdeConfig();
  const query = `?login_hint=${encodeURIComponent(`ADE.${cfg.mailboxAddress}`)}`;
  const tryHost = async (base: string, assertionAudience: string) => {
    const { jwt, audience, variantLabel } = await buildClientAssertion(assertionAudience);
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
    });
    const res = await httpsRawRequest({
      method: "POST",
      url: base.replace(/\/+$/, "") + cfg.tokenPath + query,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      useMtls: true,
    });
    return {
      ...res,
      audience,
      attempt: `host=${base}; aud=${audience}; login_hint=ADE.${cfg.mailboxAddress}; ${variantLabel}; with client_id; mTLS`,
    };
  };

  let last: (AdeRawResponse & { audience: string }) | null = null;
  for (const assertionAudience of audienceCandidates(cfg.oauthBase, process.env.ADE_ENV)) {
    const res = await tryHost(cfg.oauthBase, assertionAudience);
    last = res;
    if (res.status >= 200 && res.status < 300) return res;
    // 401 zwykle oznacza odrzucenie asercji JWT — sprawdzamy kolejny `aud`.
    if (res.status !== 401) break;
  }

  // Jeśli trafiliśmy jeszcze w host informacyjny, spróbuj starego hosta jako fallback.
  if (last?.status && last.status >= 300 && last.status < 400) {
    const legacy = legacyOauthBase(process.env.ADE_ENV);
    if (legacy !== cfg.oauthBase) {
      for (const assertionAudience of audienceCandidates(legacy, process.env.ADE_ENV)) {
        const alt = await tryHost(legacy, assertionAudience);
        last = alt;
        if (alt.status >= 200 && alt.status < 300) return alt;
        if (alt.status !== 401) break;
      }
    }
  }
  return last ?? (await tryHost(cfg.oauthBase, realmAudienceFromBase(cfg.oauthBase)));
}

// ============================================================
// Multi-tenant: warianty operujące na skrzynce z DB (ade_mailboxes)
// ============================================================

export type AdeResolvedConfig = {
  apiBase: string;
  oauthBase: string;
  tokenPath: string;
  clientId: string;
  mailboxAddress: string;
  certPem: string;
  keyPem: string;
  keyPassphrase?: string;
  adeEnv?: string;
};

const configCache = new Map<string, AdeResolvedConfig>();

export function invalidateMailboxCache(mailboxId: string) {
  configCache.delete(mailboxId);
}

/** Załaduj konfigurację skrzynki z DB (service_role) i odszyfruj PEM. */
export async function loadAdeConfigForMailbox(mailboxId: string): Promise<AdeResolvedConfig> {
  const cached = configCache.get(mailboxId);
  if (cached) return cached;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptPii } = await import("@/lib/crypto.server");
  const { data, error } = await supabaseAdmin
    .from("ade_mailboxes")
    .select("*")
    .eq("id", mailboxId)
    .maybeSingle();
  if (error) throw new Error(`Nie udało się pobrać skrzynki: ${error.message}`);
  if (!data) throw new Error(`Skrzynka ${mailboxId} nie istnieje`);
  const certPem = decryptPii(data.qwac_cert_pem_encrypted as string);
  const keyPem = decryptPii(data.qwac_key_pem_encrypted as string);
  if (!certPem || !keyPem) throw new Error("Nie udało się odszyfrować certyfikatów QWAC (klucz EXT_PII_ENCRYPTION_KEY?)");
  const passphrase = data.qwac_key_passphrase_encrypted
    ? decryptPii(data.qwac_key_passphrase_encrypted as string) ?? undefined
    : undefined;
  const adeEnv = data.ade_env as string | undefined;
  const defaults = envDefaults(adeEnv);
  const resolved: AdeResolvedConfig = {
    apiBase: (data.api_base as string | null) || defaults.apiBase,
    oauthBase: normalizeOauthBase((data.oauth_base as string | null) || defaults.oauthBase, adeEnv),
    tokenPath: (data.token_path as string | null) || DEFAULT_TOKEN_PATH,
    clientId: String(data.client_id),
    mailboxAddress: String(data.mailbox_address),
    certPem,
    keyPem,
    keyPassphrase: passphrase,
    adeEnv,
  };
  configCache.set(mailboxId, resolved);
  return resolved;
}

async function httpsRawRequestWithCfg(
  cfg: AdeResolvedConfig,
  opts: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    useMtls?: boolean;
    binary?: boolean;
  },
): Promise<AdeRawResponse> {
  const https = await import("node:https");
  const url = new URL(opts.url);
  const cert = opts.useMtls ? Buffer.from(cfg.certPem) : undefined;
  const key = opts.useMtls ? Buffer.from(cfg.keyPem) : undefined;
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
        headers: { Accept: "application/json", ...opts.headers },
        timeout: opts.timeoutMs ?? 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const socket = res.socket as
            | ({ getPeerCertificate?: () => { subject?: { CN?: string; O?: string }; issuer?: { CN?: string; O?: string } } } & object)
            | null;
          const peer = typeof socket?.getPeerCertificate === "function" ? socket.getPeerCertificate() : undefined;
          const buffer = Buffer.concat(chunks);
          resolvePromise({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]),
            ),
            body: buffer.toString("utf8"),
            bodyBuffer: opts.binary ? buffer : undefined,
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

async function buildClientAssertionForCfg(
  cfg: AdeResolvedConfig,
  audience?: string,
  variant: ClientAssertionVariant = STABLE_CLIENT_ASSERTION_VARIANT,
): Promise<{ jwt: string; audience: string; variantLabel: string }> {
  const crypto = await import("node:crypto");
  const certBody = cfg.certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const resolvedAudience = audience ?? realmAudienceFromBase(cfg.oauthBase);
  const now = Math.floor(Date.now() / 1000);
  const issuedAt = now - 60;
  const header: Record<string, string | string[]> = { alg: "RS256", typ: "JWT" };
  if (variant.includeX5c) header.x5c = [certBody];
  const payload: Record<string, string | number> = {
    iss: cfg.clientId,
    sub: cfg.clientId,
    aud: resolvedAudience,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: now + 600,
  };
  if (variant.includeNbf) payload.nbf = issuedAt;
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: cfg.keyPem, passphrase: cfg.keyPassphrase });
  return { jwt: `${signingInput}.${base64url(signature)}`, audience: resolvedAudience, variantLabel: variant.label };
}

/** mTLS request do UA API dla konkretnej skrzynki. */
export async function adeRawRequestForMailbox(
  mailboxId: string,
  opts: { method: string; path: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; binary?: boolean },
): Promise<AdeRawResponse> {
  const cfg = await loadAdeConfigForMailbox(mailboxId);
  return httpsRawRequestWithCfg(cfg, {
    method: opts.method,
    url: cfg.apiBase + opts.path,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    useMtls: true,
    binary: opts.binary,
  });
}

/** SE API (bez mTLS) dla konkretnej skrzynki. */
export async function adeSeRawRequestForMailbox(
  mailboxId: string,
  opts: { method: string; path: string; headers?: Record<string, string>; body?: string; timeoutMs?: number },
): Promise<AdeRawResponse> {
  const cfg = await loadAdeConfigForMailbox(mailboxId);
  const base = (process.env.ADE_SE_BASE || cfg.oauthBase).replace(/\/+$/, "");
  return httpsRawRequestWithCfg(cfg, {
    method: opts.method,
    url: base + opts.path,
    headers: opts.headers,
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    useMtls: false,
  });
}

/** OAuth2 token dla konkretnej skrzynki. Token endpoint wymaga mTLS. */
export async function fetchAdeTokenForMailbox(mailboxId: string): Promise<AdeRawResponse & { audience: string }> {
  const cfg = await loadAdeConfigForMailbox(mailboxId);
  const query = `?login_hint=${encodeURIComponent(`ADE.${cfg.mailboxAddress}`)}`;
  const tryHost = async (base: string, assertionAudience: string) => {
    const { jwt, audience, variantLabel } = await buildClientAssertionForCfg(cfg, assertionAudience);
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
    });
    const res = await httpsRawRequestWithCfg(cfg, {
      method: "POST",
      url: base.replace(/\/+$/, "") + cfg.tokenPath + query,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      useMtls: true,
    });
    return {
      ...res,
      audience,
      attempt: `host=${base}; aud=${audience}; login_hint=ADE.${cfg.mailboxAddress}; ${variantLabel}; with client_id; mTLS`,
    };
  };

  let last: (AdeRawResponse & { audience: string }) | null = null;
  for (const assertionAudience of audienceCandidates(cfg.oauthBase, cfg.adeEnv)) {
    const res = await tryHost(cfg.oauthBase, assertionAudience);
    last = res;
    if (res.status >= 200 && res.status < 300) return res;
    if (res.status !== 401) break;
  }

  if (last?.status && last.status >= 300 && last.status < 400) {
    const legacy = legacyOauthBase(cfg.adeEnv);
    if (legacy !== cfg.oauthBase) {
      for (const assertionAudience of audienceCandidates(legacy, cfg.adeEnv)) {
        const alt = await tryHost(legacy, assertionAudience);
        last = alt;
        if (alt.status >= 200 && alt.status < 300) return alt;
        if (alt.status !== 401) break;
      }
    }
  }
  return last ?? (await tryHost(cfg.oauthBase, realmAudienceFromBase(cfg.oauthBase)));
}

/** Test połączenia dla skrzynki z DB. */
export async function testAdeConnectionForMailbox(mailboxId: string): Promise<{
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
}> {
  const steps: Array<{ name: string; ok: boolean; detail: string }> = [];
  let cfg: AdeResolvedConfig | null = null;
  try {
    cfg = await loadAdeConfigForMailbox(mailboxId);
    steps.push({ name: "Konfiguracja", ok: true, detail: `mailbox=${cfg.mailboxAddress} clientId=${cfg.clientId}` });
  } catch (err) {
    steps.push({ name: "Konfiguracja", ok: false, detail: (err as Error).message });
    return { ok: false, steps };
  }
  // mTLS handshake — GET /
  try {
    const res = await httpsRawRequestWithCfg(cfg, { method: "GET", url: cfg.apiBase + "/", useMtls: true, timeoutMs: 10000 });
    steps.push({
      name: "mTLS handshake",
      ok: true,
      detail: `HTTP ${res.status}${res.tlsPeerIssuer ? " · Peer issuer: " + res.tlsPeerIssuer : ""}`,
    });
  } catch (err) {
    steps.push({ name: "mTLS handshake", ok: false, detail: (err as Error).message });
  }
  // OAuth2
  try {
    const res = await fetchAdeTokenForMailbox(mailboxId);
    const ok = res.status >= 200 && res.status < 300;
    let detail = `HTTP ${res.status}${res.attempt ? ` · ${res.attempt}` : ""}`;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers?.location || res.headers?.Location || "(brak nagłówka Location)";
      detail += ` → Location: ${loc}`;
    } else {
      try {
        const parsed = JSON.parse(res.body) as { access_token?: string; error?: string; error_description?: string };
        if (parsed.access_token) detail += ` · token OK (${parsed.access_token.length} znaków)`;
        else if (parsed.error) detail += ` · ${parsed.error}${parsed.error_description ? ": " + parsed.error_description : ""}`;
        else detail += ` · ${res.body.slice(0, 200)}`;
      } catch {
        detail += ` · ${res.body.slice(0, 200)}`;
      }
    }
    steps.push({ name: "OAuth2 token", ok, detail });
  } catch (err) {
    steps.push({ name: "OAuth2 token", ok: false, detail: (err as Error).message });
  }
  return { ok: steps.every((s) => s.ok), steps };
}

