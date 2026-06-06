// Cron: codzienne sprawdzenie kont YouTube w trybie OAuth=Testing.
// Wstawia user_notifications dla ownerów/adminów organizacji, gdy
// refresh_token zbliża się do wygaśnięcia (>=5 dni od ostatniego grantu)
// lub już wygasł (>=7 dni). Anty-spam: refresh_alert_sent_at.
//
// POST + nagłówek X-Cron-Secret = process.env.CRON_SECRET
// Częstotliwość zalecana: co 6h (lub raz dziennie).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REFRESH_TTL_DAYS = 7;
const WARN_AT_DAYS = 5; // ostrzegamy gdy >=5 dni od ostatniego grantu (czyli <=2 dni do końca)

type CredRow = {
  organization_id: string;
  extra: { youtube_oauth_testing?: boolean } | null;
};

type AccRow = {
  id: string;
  organization_id: string;
  updated_at: string;
  connected_at: string;
  status: string;
  refresh_alert_sent_at: string | null;
  account_name: string;
  external_account_id: string;
};

type MemberRow = { user_id: string; role: string };

async function processTick() {
  const startedAt = Date.now();

  // 1) organizacje, które oznaczyły YouTube jako Testing
  const { data: credRows, error: credErr } = await supabaseAdmin
    .from("social_app_credentials")
    .select("organization_id, extra")
    .eq("platform", "youtube");
  if (credErr) throw new Error(credErr.message);
  const testingOrgs = new Set<string>(
    ((credRows ?? []) as CredRow[])
      .filter((r) => r.extra?.youtube_oauth_testing === true)
      .map((r) => r.organization_id),
  );
  if (testingOrgs.size === 0) {
    return { checked: 0, warned: 0, expired: 0, notifications: 0 };
  }

  // 2) konta YouTube w tych organizacjach
  const { data: accRows, error: accErr } = await supabaseAdmin
    .from("social_accounts")
    .select(
      "id, organization_id, updated_at, connected_at, status, refresh_alert_sent_at, account_name, external_account_id",
    )
    .eq("platform", "youtube")
    .in("organization_id", Array.from(testingOrgs));
  if (accErr) throw new Error(accErr.message);
  const accounts = (accRows ?? []) as AccRow[];

  let warnedCount = 0;
  let expiredCount = 0;
  let notificationsCreated = 0;
  const now = Date.now();

  for (const acc of accounts) {
    const grantedAtIso = acc.updated_at ?? acc.connected_at;
    const grantedAt = new Date(grantedAtIso).getTime();
    const ageDays = (now - grantedAt) / (24 * 3600 * 1000);
    const isExpired = ageDays >= REFRESH_TTL_DAYS;
    const isWarning = !isExpired && ageDays >= WARN_AT_DAYS;
    if (!isExpired && !isWarning) continue;

    // Anti-spam: nie wysyłaj ponownie jeśli już wysłaliśmy po ostatnim grancie.
    const alreadySent =
      acc.refresh_alert_sent_at &&
      new Date(acc.refresh_alert_sent_at).getTime() > grantedAt;
    if (alreadySent && !isExpired) continue;
    if (alreadySent && isExpired && acc.status === "error") continue;

    // 3) pobierz adresatów: owner + admin organizacji
    const { data: members } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", acc.organization_id)
      .in("role", ["owner", "admin"]);
    const recipients = ((members ?? []) as MemberRow[]).map((m) => m.user_id);
    if (recipients.length === 0) continue;

    const kind = isExpired
      ? "social_youtube_refresh_expired"
      : "social_youtube_refresh_expiring";
    const daysLeft = Math.max(0, Math.ceil(REFRESH_TTL_DAYS - ageDays));
    const payload = {
      organization_id: acc.organization_id,
      account_id: acc.id,
      account_name: acc.account_name,
      external_channel_id: acc.external_account_id,
      days_left: daysLeft,
      granted_at: grantedAtIso,
      expires_at: new Date(grantedAt + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString(),
    };

    const rows = recipients.map((uid) => ({
      user_id: uid,
      kind,
      payload,
    }));
    const { error: insErr } = await supabaseAdmin.from("user_notifications").insert(rows);
    if (insErr) {
      console.error("[yt-token-check] insert notifications failed", insErr);
      continue;
    }
    notificationsCreated += rows.length;

    // 4) oznacz konto i (jeśli wygasło) ustaw status=error
    const updates: Record<string, unknown> = {
      refresh_alert_sent_at: new Date().toISOString(),
    };
    if (isExpired) {
      updates.status = "error";
      updates.last_error =
        "YouTube refresh_token wygasł (tryb OAuth=Testing, limit Google 7 dni). Połącz konto ponownie.";
      expiredCount++;
    } else {
      warnedCount++;
    }
    await supabaseAdmin.from("social_accounts").update(updates).eq("id", acc.id);
  }

  console.log(
    `[yt-token-check] done in ${Date.now() - startedAt}ms — checked=${accounts.length} warned=${warnedCount} expired=${expiredCount} notifications=${notificationsCreated}`,
  );
  return {
    checked: accounts.length,
    warned: warnedCount,
    expired: expiredCount,
    notifications: notificationsCreated,
  };
}

export const Route = createFileRoute("/api/public/social-youtube-token-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("CRON_SECRET not configured", { status: 500 });
        if (request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        try {
          const out = await processTick();
          return Response.json({ success: true, ...out });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });
        return Response.json({ ok: true, hint: "Use POST to run tick" });
      },
    },
  },
});
