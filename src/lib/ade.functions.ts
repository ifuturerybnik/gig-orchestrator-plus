import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdeTestResult = {
  ok: boolean;
  steps: Array<{
    name: string;
    ok: boolean;
    detail: string;
  }>;
  config: {
    apiBase: string;
    oauthBase: string;
    tokenPath: string;
    clientId: string;
    mailboxAddress: string;
    certPath: string;
    keyPath: string;
  };
};

export const testAdeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdeTestResult> => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (rolesError) throw new Error(`Nie udało się sprawdzić uprawnień administratora: ${rolesError.message}`);

    const roleList = (roles ?? []).map((row) => String(row.role));
    const isAdmin = roleList.includes("super_admin") || roleList.includes("admin_staff");
    if (!isAdmin) throw new Error("Brak uprawnień administratora");

    const { loadAdeConfig, adeRawRequest, fetchAdeToken } = await import("@/lib/ade-client.server");

    const steps: AdeTestResult["steps"] = [];
    let cfg: ReturnType<typeof loadAdeConfig> | null = null;

    try {
      cfg = loadAdeConfig();
      steps.push({ name: "Konfiguracja env", ok: true, detail: "Wszystkie zmienne ADE_* obecne" });
    } catch (err) {
      steps.push({ name: "Konfiguracja env", ok: false, detail: (err as Error).message });
      return {
        ok: false,
        steps,
        config: {
          apiBase: process.env.ADE_API_BASE ?? "(brak)",
          oauthBase: process.env.ADE_OAUTH_BASE ?? "(brak)",
          tokenPath: process.env.ADE_TOKEN_PATH ?? "(domyślny)",
          clientId: process.env.ADE_CLIENT_ID ?? "(brak)",
          mailboxAddress: process.env.ADE_MAILBOX_ADDRESS ?? "(brak)",
          certPath: process.env.ADE_QWAC_CERT_PATH ?? "(brak)",
          keyPath: process.env.ADE_QWAC_KEY_PATH ?? "(brak)",
        },
      };
    }

    // Step 1: pliki certyfikatu
    try {
      const fs = await import("node:fs");
      const certStat = fs.statSync(cfg.certPath);
      const keyStat = fs.statSync(cfg.keyPath);
      steps.push({
        name: "Pliki QWAC",
        ok: true,
        detail: `cert: ${certStat.size} B, key: ${keyStat.size} B`,
      });
    } catch (err) {
      steps.push({ name: "Pliki QWAC", ok: false, detail: (err as Error).message });
    }

    // Step 2: mTLS handshake — GET /
    try {
      const res = await adeRawRequest({ method: "GET", path: "/", timeoutMs: 10000 });
      steps.push({
        name: "mTLS handshake",
        ok: true,
        detail: `HTTP ${res.status}${res.tlsPeerIssuer ? " · Peer issuer: " + res.tlsPeerIssuer : ""}`,
      });
    } catch (err) {
      const msg = (err as Error).message;
      steps.push({
        name: "mTLS handshake",
        ok: false,
        detail: msg,
      });
    }

    // Step 3: token OAuth2
    try {
      const res = await fetchAdeToken();
      const ok = res.status >= 200 && res.status < 300;
      let detail = `HTTP ${res.status}`;
      // Redirecty (301/302/303/307/308) — pokaż nagłówek Location, żeby zdiagnozować dokąd przekierowuje KSDE
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers?.location || res.headers?.Location || "(brak nagłówka Location)";
        detail += ` → Location: ${loc}`;
      } else {
        try {
          const parsed = JSON.parse(res.body) as { access_token?: string; error?: string; error_description?: string };
          if (parsed.access_token) {
            detail += ` · token otrzymany (${parsed.access_token.length} znaków)`;
          } else if (parsed.error) {
            detail += ` · ${parsed.error}${parsed.error_description ? ": " + parsed.error_description : ""}`;
          } else {
            detail += ` · ${res.body.slice(0, 200)}`;
          }
        } catch {
          detail += ` · ${res.body.slice(0, 200)}`;
        }
      }
      steps.push({ name: "OAuth2 token", ok, detail });
    } catch (err) {
      steps.push({ name: "OAuth2 token", ok: false, detail: (err as Error).message });
    }

    return {
      ok: steps.every((s) => s.ok),
      steps,
      config: {
        apiBase: cfg.apiBase,
        oauthBase: cfg.oauthBase,
        tokenPath: cfg.tokenPath,
        clientId: cfg.clientId,
        mailboxAddress: cfg.mailboxAddress,
        certPath: cfg.certPath,
        keyPath: cfg.keyPath,
      },
    };
  });
