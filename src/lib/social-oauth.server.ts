// SERVER-ONLY. Handlery OAuth callback dla platform SM.
// Importowane TYLKO przez server routes pod /api/public/social/*.
import { encryptPii, decryptPii } from "./crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  exchangeLinkedInCode,
  fetchLinkedInUserInfo,
} from "./platforms/linkedin.server";
import {
  exchangeLongLivedUserToken,
  exchangeInstagramLoginCode,
  exchangeLongLivedInstagramToken,
  exchangeMetaCode,
  fetchPageInstagramAccount,
  fetchInstagramLoginProfile,
  listUserPages,
  listUserPermissions,
} from "./platforms/meta.server";
import {
  exchangeGoogleCode,
  fetchYouTubeChannel,
} from "./platforms/youtube.server";
import {
  exchangeTikTokCode,
  fetchTikTokUserInfo,
} from "./platforms/tiktok.server";
import {
  exchangeSpotifyCode,
  fetchSpotifyMe,
} from "./platforms/spotify.server";



export async function handleXOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{ orgId: string; accountName: string; redirectBack: string | null }> {
  const admin = supabaseAdmin;

  // 1) state
  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "twitter") throw new Error("State nie pasuje do platformy X.");
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  // 2) decrypt code_verifier
  const decoded = decryptPii(s.redirect_back);
  if (!decoded) throw new Error("Nie udało się odczytać code_verifier.");
  const { v: codeVerifier, r: redirectBack } = JSON.parse(decoded) as {
    v: string;
    r: string | null;
  };

  // 3) credentials
  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", "twitter")
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error("Brak credentials aplikacji X dla organizacji.");
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  // 4) token exchange
  const basic = Buffer.from(`${client_id}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.callbackUrl,
    code_verifier: codeVerifier,
  });
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`X token exchange ${tokenRes.status}: ${t.slice(0, 300)}`);
  }
  const tok = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  // 5) /users/me
  const meRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=username,profile_image_url,name",
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  if (!meRes.ok) {
    const t = await meRes.text();
    throw new Error(`X /users/me ${meRes.status}: ${t.slice(0, 300)}`);
  }
  const me = (await meRes.json()) as {
    data: { id: string; username: string; name: string; profile_image_url?: string };
  };

  // 6) upsert social_accounts
  const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  const accessEnc = encryptPii(tok.access_token);
  const refreshEnc = tok.refresh_token ? encryptPii(tok.refresh_token) : null;

  const { error: upErr } = await admin
    .from("social_accounts")
    .upsert(
      {
        organization_id: s.organization_id,
        platform: "twitter",
        external_account_id: me.data.id,
        account_name: `@${me.data.username}`,
        account_avatar_url: me.data.profile_image_url ?? null,
        scopes: tok.scope.split(" "),
        access_token_enc: accessEnc,
        refresh_token_enc: refreshEnc,
        token_expires_at: expiresAt,
        status: "connected",
        last_error: null,
        connected_by: s.user_id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform" },
    );
  if (upErr) throw new Error(upErr.message);

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return {
    orgId: s.organization_id,
    accountName: `@${me.data.username}`,
    redirectBack: redirectBack ?? null,
  };
}

export async function handleLinkedInOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{ orgId: string; accountName: string; redirectBack: string | null }> {
  const admin = supabaseAdmin;

  // 1) state
  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "linkedin") throw new Error("State nie pasuje do platformy LinkedIn.");
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  // 2) redirect_back (LinkedIn nie używa PKCE u nas — w blobie jest tylko {r})
  let redirectBack: string | null = null;
  if (s.redirect_back) {
    const decoded = decryptPii(s.redirect_back);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { r?: string | null };
        redirectBack = parsed.r ?? null;
      } catch {
        redirectBack = null;
      }
    }
  }

  // 3) credentials
  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", "linkedin")
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error("Brak credentials aplikacji LinkedIn dla organizacji.");
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  // 4) token exchange
  const tok = await exchangeLinkedInCode({
    code: args.code,
    redirectUri: args.callbackUrl,
    clientId: client_id,
    clientSecret,
  });

  // 5) /userinfo
  const me = await fetchLinkedInUserInfo(tok.accessToken);

  // 6) upsert social_accounts
  const accountName = me.name ?? me.email ?? `LinkedIn ${me.sub.slice(0, 6)}`;
  const { error: upErr } = await admin
    .from("social_accounts")
    .upsert(
      {
        organization_id: s.organization_id,
        platform: "linkedin",
        external_account_id: me.sub,
        account_name: accountName,
        account_avatar_url: me.picture ?? null,
        scopes: tok.scope ? tok.scope.split(" ") : [],
        access_token_enc: encryptPii(tok.accessToken),
        refresh_token_enc: tok.refreshToken ? encryptPii(tok.refreshToken) : null,
        token_expires_at: tok.expiresAt,
        status: "connected",
        last_error: null,
        connected_by: s.user_id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform" },
    );
  if (upErr) throw new Error(upErr.message);

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return { orgId: s.organization_id, accountName, redirectBack };
}

// =============================================================================
// Meta (Facebook + Instagram) — wspólny callback
// =============================================================================
// State zapisany pod platform="facebook" (canonical). Po wymianie code →
// long-lived user token → /me/accounts pobieramy pierwszą stronę i (jeśli jest)
// powiązany Instagram Business Account. Zapisujemy DWA rekordy:
// social_accounts (platform=facebook) + social_accounts (platform=instagram).
// W social_app_credentials credentials żyją pod platform="facebook"; adapter
// IG też ich używa (patrz getAppCredentialsServer fallback).

export type MetaDiagnostics = {
  granted: string[];
  declined: string[];
  pages: Array<{
    id: string;
    name: string;
    businessId: string | null;
    businessName: string | null;
    tasks: string[];
    hasInstagram: boolean;
    instagramUsername: string | null;
    selected: boolean;
  }>;
};

export async function handleMetaOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{
  orgId: string;
  facebookPageName: string | null;
  instagramUsername: string | null;
  redirectBack: string | null;
  diagnostics: MetaDiagnostics | null;
}> {
  const admin = supabaseAdmin;

  // 1) state
  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "facebook" && s.platform !== "instagram") {
    throw new Error("State nie pasuje do platformy Meta.");
  }
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  // 2) redirect_back (Meta bez PKCE — w blobie tylko {r})
  let redirectBack: string | null = null;
  if (s.redirect_back) {
    const decoded = decryptPii(s.redirect_back);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { r?: string | null };
        redirectBack = parsed.r ?? null;
      } catch {
        redirectBack = null;
      }
    }
  }

  // 3) credentials — Facebook i Instagram mają osobne produkty OAuth.
  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", s.platform)
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error(`Brak credentials aplikacji ${s.platform === "instagram" ? "Instagram" : "Facebook"} dla organizacji.`);
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  if (s.platform === "instagram") {
    const shortIg = await exchangeInstagramLoginCode({
      code: args.code,
      redirectUri: args.callbackUrl,
      clientId: client_id,
      clientSecret,
    });
    const longIg = await exchangeLongLivedInstagramToken({
      shortToken: shortIg.accessToken,
      clientSecret,
    });
    const profile = await fetchInstagramLoginProfile(longIg.accessToken);
    const expiresAt = longIg.expiresIn
      ? new Date(Date.now() + longIg.expiresIn * 1000).toISOString()
      : null;
    const scopes = shortIg.scopes.length > 0
      ? shortIg.scopes
      : ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments"];

    const { error: upIgErr } = await admin.from("social_accounts").upsert(
      {
        organization_id: s.organization_id,
        platform: "instagram",
        external_account_id: profile.id,
        account_name: `@${profile.username}`,
        account_avatar_url: null,
        scopes,
        access_token_enc: encryptPii(longIg.accessToken),
        refresh_token_enc: null,
        token_expires_at: expiresAt,
        status: "connected",
        last_error: null,
        connected_by: s.user_id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform" },
    );
    if (upIgErr) throw new Error(`Zapis konta Instagram: ${upIgErr.message}`);
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    return {
      orgId: s.organization_id,
      facebookPageName: null,
      instagramUsername: profile.username,
      redirectBack,
      diagnostics: null,
    };
  }

  // 4) code → short user token
  const shortTok = await exchangeMetaCode({
    code: args.code,
    redirectUri: args.callbackUrl,
    clientId: client_id,
    clientSecret,
  });

  // 5) short → long-lived user token (~60 dni)
  const longTok = await exchangeLongLivedUserToken({
    shortToken: shortTok.accessToken,
    clientId: client_id,
    clientSecret,
  });

  // 6) Diagnostyka: permissions + lista stron
  const perms = await listUserPermissions(longTok.accessToken);
  const rawPages = await listUserPages(longTok.accessToken);
  const pages = await Promise.all(
    rawPages.map(async (p) =>
      p.instagram
        ? p
        : { ...p, instagram: await fetchPageInstagramAccount(p.id, p.access_token) },
    ),
  );

  const buildDiag = (selectedId: string | null): MetaDiagnostics => ({
    granted: perms.granted,
    declined: perms.declined,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      businessId: p.business?.id ?? null,
      businessName: p.business?.name ?? null,
      tasks: p.tasks ?? [],
      hasInstagram: !!p.instagram,
      instagramUsername: p.instagram?.username ?? null,
      selected: p.id === selectedId,
    })),
  });

  if (pages.length === 0) {
    console.error("[meta-callback] empty /me/accounts. granted=", perms.granted, "declined=", perms.declined);
    const missing = ["pages_show_list", "pages_read_engagement"]
      .filter((p) => !perms.granted.includes(p));
    const hint =
      missing.length > 0
        ? `Brakuje przyznanych uprawnień: ${missing.join(", ")}.`
        : 'Wszystkie uprawnienia zostały przyznane, ale Meta nie zwróciła żadnej strony — najczęściej znaczy to, że w oknie autoryzacji nie wybrałeś konkretnej strony (kliknij "Edytuj dostęp" → "Wybierz strony" i zaznacz właściwy Fanpage) albo że Twoje konto nie ma roli administratora tej strony w Business Managerze.';
    const err = new Error(
      `Nie znaleziono żadnej strony Facebook na tym koncie. ${hint} Granted: [${perms.granted.join(", ") || "—"}]. Declined: [${perms.declined.join(", ") || "—"}].`,
    );
    // Dołącz diagnostykę do błędu (callback ją odczyta i wyświetli)
    (err as Error & { diagnostics?: MetaDiagnostics }).diagnostics = buildDiag(null);
    throw err;
  }
  // Preferuj stronę z podpiętym Instagram Business; fallback: pierwsza.
  const page = pages.find((p) => !!p.instagram) ?? pages[0];

  // Page tokens z long-lived user tokena są tzw. "never expire"
  const tokenExpiresAt: string | null = null;

  // 7) upsert facebook
  const { error: upFbErr } = await admin.from("social_accounts").upsert(
    {
      organization_id: s.organization_id,
      platform: "facebook",
      external_account_id: page.id,
      account_name: page.name,
      account_avatar_url: page.picture ?? null,
      scopes: perms.granted,
      access_token_enc: encryptPii(page.access_token),
      refresh_token_enc: null,
      token_expires_at: tokenExpiresAt,
      status: "connected",
      last_error: null,
      connected_by: s.user_id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,platform" },
  );
  if (upFbErr) throw new Error(`Zapis konta Facebook: ${upFbErr.message}`);

  // 8) Jeżeli strona FB ma podłączone konto Instagram Business, zapisujemy też IG
  // tylko wtedy, gdy nie istnieje już osobny token Instagram Login.
  let igUsername: string | null = null;
  if (
    page.instagram &&
    perms.granted.includes("instagram_basic") &&
    perms.granted.includes("instagram_content_publish") &&
    perms.granted.includes("instagram_manage_comments")
  ) {
    igUsername = page.instagram.username;
    const { data: existingIg } = await admin
      .from("social_accounts")
      .select("scopes")
      .eq("organization_id", s.organization_id)
      .eq("platform", "instagram")
      .maybeSingle();
    const hasInstagramLoginToken = ((existingIg as { scopes?: string[] } | null)?.scopes ?? [])
      .some((scope) => scope.startsWith("instagram_business_"));
    if (hasInstagramLoginToken) {
      await admin.from("social_oauth_states").delete().eq("state", args.state);
      return {
        orgId: s.organization_id,
        facebookPageName: page.name,
        instagramUsername: igUsername,
        redirectBack,
        diagnostics: buildDiag(page.id),
      };
    }
    const { error: upIgErr } = await admin.from("social_accounts").upsert(
      {
        organization_id: s.organization_id,
        platform: "instagram",
        external_account_id: page.instagram.id,
        account_name: `@${page.instagram.username}`,
        account_avatar_url: page.instagram.profile_picture_url ?? null,
        scopes: perms.granted,
        access_token_enc: encryptPii(page.access_token),
        refresh_token_enc: null,
        token_expires_at: tokenExpiresAt,
        status: "connected",
        last_error: null,
        connected_by: s.user_id,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform" },
    );
    if (upIgErr) throw new Error(`Zapis konta Instagram: ${upIgErr.message}`);
  }

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return {
    orgId: s.organization_id,
    facebookPageName: page.name,
    instagramUsername: igUsername,
    redirectBack,
    diagnostics: buildDiag(page.id),
  };
}

// =============================================================================
// YouTube (Google OAuth 2.0)
// =============================================================================

export async function handleYouTubeOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{ orgId: string; accountName: string; redirectBack: string | null }> {
  const admin = supabaseAdmin;

  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "youtube") throw new Error("State nie pasuje do platformy YouTube.");
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  let redirectBack: string | null = null;
  if (s.redirect_back) {
    const decoded = decryptPii(s.redirect_back);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { r?: string | null };
        redirectBack = parsed.r ?? null;
      } catch {
        redirectBack = null;
      }
    }
  }

  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", "youtube")
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error("Brak credentials aplikacji Google dla organizacji.");
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  const tok = await exchangeGoogleCode({
    code: args.code,
    redirectUri: args.callbackUrl,
    clientId: client_id,
    clientSecret,
  });

  if (!tok.refreshToken) {
    throw new Error(
      "Google nie zwrócił refresh_token. Usuń aplikację z https://myaccount.google.com/permissions i spróbuj ponownie.",
    );
  }

  const channel = await fetchYouTubeChannel(tok.accessToken);

  const { error: upErr } = await admin.from("social_accounts").upsert(
    {
      organization_id: s.organization_id,
      platform: "youtube",
      external_account_id: channel.channelId,
      account_name: channel.title,
      account_avatar_url: channel.thumbnailUrl,
      scopes: tok.scope ? tok.scope.split(" ") : [],
      access_token_enc: encryptPii(tok.accessToken),
      refresh_token_enc: encryptPii(tok.refreshToken),
      token_expires_at: tok.expiresAt,
      status: "connected",
      last_error: null,
      connected_by: s.user_id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,platform" },
  );
  if (upErr) throw new Error(upErr.message);

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return { orgId: s.organization_id, accountName: channel.title, redirectBack };
}

// =============================================================================
// TikTok (OAuth 2.0)
// =============================================================================

export async function handleTikTokOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{ orgId: string; accountName: string; redirectBack: string | null }> {
  const admin = supabaseAdmin;

  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "tiktok") throw new Error("State nie pasuje do platformy TikTok.");
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  let redirectBack: string | null = null;
  if (s.redirect_back) {
    const decoded = decryptPii(s.redirect_back);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { r?: string | null };
        redirectBack = parsed.r ?? null;
      } catch {
        redirectBack = null;
      }
    }
  }

  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", "tiktok")
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error("Brak credentials aplikacji TikTok dla organizacji.");
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  const tok = await exchangeTikTokCode({
    code: args.code,
    redirectUri: args.callbackUrl,
    clientKey: client_id,
    clientSecret,
  });

  const me = await fetchTikTokUserInfo(tok.accessToken);
  const accountName = me.displayName.startsWith("@")
    ? me.displayName
    : `@${me.displayName}`;

  const { error: upErr } = await admin.from("social_accounts").upsert(
    {
      organization_id: s.organization_id,
      platform: "tiktok",
      external_account_id: me.openId,
      account_name: accountName,
      account_avatar_url: me.avatarUrl,
      scopes: tok.scope ? tok.scope.split(",") : [],
      access_token_enc: encryptPii(tok.accessToken),
      refresh_token_enc: tok.refreshToken ? encryptPii(tok.refreshToken) : null,
      token_expires_at: tok.expiresAt,
      status: "connected",
      last_error: null,
      connected_by: s.user_id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,platform" },
  );
  if (upErr) throw new Error(upErr.message);

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return { orgId: s.organization_id, accountName, redirectBack };
}



// =============================================================================
// Spotify (OAuth 2.0 Authorization Code)
// =============================================================================

export async function handleSpotifyOAuthCallback(args: {
  code: string;
  state: string;
  callbackUrl: string;
}): Promise<{ orgId: string; accountName: string; redirectBack: string | null }> {
  const admin = supabaseAdmin;

  const { data: stateRow, error: stateErr } = await admin
    .from("social_oauth_states")
    .select("organization_id, user_id, platform, redirect_back, expires_at")
    .eq("state", args.state)
    .maybeSingle();
  if (stateErr) throw new Error(stateErr.message);
  if (!stateRow) throw new Error("Nieznany lub wygasły state OAuth.");
  const s = stateRow as {
    organization_id: string;
    user_id: string;
    platform: string;
    redirect_back: string | null;
    expires_at: string;
  };
  if (s.platform !== "spotify_artists") {
    throw new Error("State nie pasuje do platformy Spotify.");
  }
  if (new Date(s.expires_at).getTime() < Date.now()) {
    await admin.from("social_oauth_states").delete().eq("state", args.state);
    throw new Error("State OAuth wygasł — uruchom proces od nowa.");
  }

  let redirectBack: string | null = null;
  if (s.redirect_back) {
    const decoded = decryptPii(s.redirect_back);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { r?: string | null };
        redirectBack = parsed.r ?? null;
      } catch {
        redirectBack = null;
      }
    }
  }

  const { data: credRow, error: credErr } = await admin
    .from("social_app_credentials")
    .select("client_id, client_secret_enc")
    .eq("organization_id", s.organization_id)
    .eq("platform", "spotify_artists")
    .maybeSingle();
  if (credErr) throw new Error(credErr.message);
  if (!credRow) throw new Error("Brak credentials aplikacji Spotify dla organizacji.");
  const { client_id, client_secret_enc } = credRow as {
    client_id: string;
    client_secret_enc: string;
  };
  const clientSecret = decryptPii(client_secret_enc);
  if (!clientSecret) throw new Error("Nie udało się odszyfrować Client Secret.");

  const tok = await exchangeSpotifyCode({
    code: args.code,
    redirectUri: args.callbackUrl,
    clientId: client_id,
    clientSecret,
  });

  const me = await fetchSpotifyMe(tok.accessToken);

  const { error: upErr } = await admin.from("social_accounts").upsert(
    {
      organization_id: s.organization_id,
      platform: "spotify_artists",
      external_account_id: me.id,
      account_name: me.displayName,
      account_avatar_url: me.avatarUrl,
      scopes: tok.scope ? tok.scope.split(" ") : [],
      access_token_enc: encryptPii(tok.accessToken),
      refresh_token_enc: tok.refreshToken ? encryptPii(tok.refreshToken) : null,
      token_expires_at: tok.expiresAt,
      status: "connected",
      last_error: null,
      connected_by: s.user_id,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,platform" },
  );
  if (upErr) throw new Error(upErr.message);

  await admin.from("social_oauth_states").delete().eq("state", args.state);

  return { orgId: s.organization_id, accountName: me.displayName, redirectBack };
}
