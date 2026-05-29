// SERVER-ONLY. Dispatcher: per-platform adaptery + helper getValidAccessToken.
// Importowane przez:
//  - src/lib/social-publish.server.ts (publikacja + odpowiedzi)
//  - crony src/routes/api/public/social-sync-*.ts

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptPii, encryptPii } from "../crypto.server";
import type { SocialPlatformId } from "../social-platforms";
import { refreshTwitterToken, twitterAdapter } from "./twitter.server";
import type { PlatformAccount, PlatformAdapter } from "./types";

// Mapa platformId → adapter. Kolejne tury dorzucają tu wpisy.
export const PLATFORM_ADAPTERS: Partial<Record<SocialPlatformId, PlatformAdapter>> = {
  twitter: twitterAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | null {
  return PLATFORM_ADAPTERS[platform as SocialPlatformId] ?? null;
}

// -------- pobranie credentials org+platforma (Client ID + Client Secret odszyfrowane) --------

export async function getAppCredentialsServer(
  organizationId: string,
  platform: string,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { client_id: string; client_secret_enc: string };
  const secret = decryptPii(row.client_secret_enc);
  if (!secret) throw new Error("Nie udało się odszyfrować Client Secret.");
  return { clientId: row.client_id, clientSecret: secret };
}

// -------- pobranie konta z odszyfrowanym access_token (z auto-refresh) --------

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // odśwież jeśli zostało <5 min

export async function getValidAccount(args: {
  organizationId: string;
  platform: string;
}): Promise<{
  account: PlatformAccount;
  credentials: { clientId: string; clientSecret: string };
} | null> {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select(
      "id, organization_id, platform, external_account_id, account_name, access_token_enc, refresh_token_enc, token_expires_at",
    )
    .eq("organization_id", args.organizationId)
    .eq("platform", args.platform)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    id: string;
    organization_id: string;
    platform: string;
    external_account_id: string;
    account_name: string;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    token_expires_at: string | null;
  };
  if (!row.access_token_enc) {
    throw new Error(`Konto ${row.platform} nie ma access_token — wymagana ponowna autoryzacja.`);
  }
  const credentials = await getAppCredentialsServer(args.organizationId, args.platform);
  if (!credentials) throw new Error("Brak skonfigurowanych Client ID/Secret dla platformy.");

  let accessToken = decryptPii(row.access_token_enc);
  let refreshToken = row.refresh_token_enc ? decryptPii(row.refresh_token_enc) : null;
  let expiresAt = row.token_expires_at;
  if (!accessToken) throw new Error("Nie udało się odszyfrować access_token.");

  const needsRefresh =
    expiresAt && new Date(expiresAt).getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (needsRefresh && refreshToken) {
    if (row.platform === "twitter") {
      const refreshed = await refreshTwitterToken({
        refreshToken,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken ?? refreshToken;
      expiresAt = refreshed.expiresAt;
      await supabaseAdmin
        .from("social_accounts")
        .update({
          access_token_enc: encryptPii(accessToken),
          refresh_token_enc: refreshToken ? encryptPii(refreshToken) : null,
          token_expires_at: expiresAt,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    // (kolejne platformy w kolejnych turach)
  }

  const account: PlatformAccount = {
    id: row.id,
    organization_id: row.organization_id,
    platform: row.platform,
    external_account_id: row.external_account_id,
    account_name: row.account_name,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: expiresAt,
  };
  return { account, credentials };
}

// -------- zapis błędu na koncie (dla widoczności w UI) --------

export async function markAccountError(accountId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("social_accounts")
    .update({
      last_error: message.slice(0, 500),
      status: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

export async function clearAccountError(accountId: string): Promise<void> {
  await supabaseAdmin
    .from("social_accounts")
    .update({
      last_error: null,
      status: "connected",
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}
