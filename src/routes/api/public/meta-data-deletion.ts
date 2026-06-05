// Meta "Data Deletion Callback URL" — wymagane przez App Review.
// Meta POST-uje x-www-form-urlencoded z polem `signed_request`.
// Format: <base64url(sig)>.<base64url(payloadJson)>
// Weryfikujemy HMAC-SHA256(payload, app_secret) === sig.
//
// Po weryfikacji:
//  - logujemy żądanie w meta_data_deletion_requests (confirmation_code = uuid),
//  - rozłączamy wszystkie social_accounts (FB/IG) gdzie external_account_id = fb_user_id,
//  - zwracamy JSON { url, confirmation_code } — wymagany format Meta.
//
// Sekret aplikacji:
//  - Najpierw EXT_META_APP_SECRET (oficjalna aplikacja Concertivo do App Review).
//  - Fallback: iteracja po social_app_credentials (per-org), bo użytkownicy
//    mogą mieć własne aplikacje Meta i też skonfigurować ten sam callback URL.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptPii } from "@/lib/crypto.server";

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function verifySignedRequest(
  signed: string,
  appSecret: string,
): { payload: Record<string, unknown> } | null {
  const dot = signed.indexOf(".");
  if (dot < 0) return null;
  const sigB64 = signed.slice(0, dot);
  const payloadB64 = signed.slice(dot + 1);
  const expected = createHmac("sha256", appSecret).update(payloadB64).digest();
  let received: Buffer;
  try {
    received = base64UrlDecode(sigB64);
  } catch {
    return null;
  }
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as Record<
      string,
      unknown
    >;
    return { payload };
  } catch {
    return null;
  }
}

async function resolveAppSecrets(): Promise<string[]> {
  const secrets: string[] = [];
  const central = process.env.EXT_META_APP_SECRET;
  if (central) secrets.push(central);
  try {
    const { data } = await supabaseAdmin
      .from("social_app_credentials")
      .select("client_secret_enc, platform")
      .in("platform", ["facebook", "instagram", "meta"]);
    for (const row of data ?? []) {
      const enc = (row as { client_secret_enc?: string | null }).client_secret_enc;
      const plain = decryptPii(enc);
      if (plain) secrets.push(plain);
    }
  } catch {
    // ignore — central secret may still work
  }
  return secrets;
}

function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export const Route = createFileRoute("/api/public/meta-data-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let signedRequest = "";
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
            const form = await request.formData();
            signedRequest = (form.get("signed_request") as string | null) ?? "";
          } else {
            const body = await request.text();
            const params = new URLSearchParams(body);
            signedRequest = params.get("signed_request") ?? "";
            if (!signedRequest && body.trim().startsWith("{")) {
              try {
                const json = JSON.parse(body) as { signed_request?: string };
                signedRequest = json.signed_request ?? "";
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore — handled below
        }

        if (!signedRequest) {
          return new Response(
            JSON.stringify({ error: "Missing signed_request" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const secrets = await resolveAppSecrets();
        let verified: { payload: Record<string, unknown> } | null = null;
        for (const s of secrets) {
          verified = verifySignedRequest(signedRequest, s);
          if (verified) break;
        }

        if (!verified) {
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { "content-type": "application/json" } },
          );
        }

        const fbUserId = String(verified.payload.user_id ?? "");
        const appId = verified.payload.app_id ? String(verified.payload.app_id) : null;
        if (!fbUserId) {
          return new Response(
            JSON.stringify({ error: "Missing user_id in payload" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const confirmationCode = randomUUID();
        let affected = 0;
        let errorMsg: string | null = null;

        try {
          // Spróbuj rozłączyć powiązane konta — match po external_account_id.
          // (FB user_id niekoniecznie = page/IG account id, ale w niektórych przypadkach
          // może być wykorzystywany; bezpieczna próba, brak danych = 0.)
          const { data: matched, error: matchErr } = await supabaseAdmin
            .from("social_accounts")
            .select("id")
            .in("platform", ["facebook", "instagram"])
            .eq("external_account_id", fbUserId);
          if (matchErr) throw new Error(matchErr.message);

          if (matched && matched.length > 0) {
            const ids = matched.map((r) => (r as { id: string }).id);
            const { error: delErr } = await supabaseAdmin
              .from("social_accounts")
              .delete()
              .in("id", ids);
            if (delErr) throw new Error(delErr.message);
            affected = ids.length;
          }
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : String(e);
        }

        await supabaseAdmin.from("meta_data_deletion_requests").insert({
          confirmation_code: confirmationCode,
          fb_user_id: fbUserId,
          app_id: appId,
          signed_request_raw: signedRequest,
          status: errorMsg ? "failed" : "processed",
          affected_accounts: affected,
          error: errorMsg,
          processed_at: new Date().toISOString(),
        });

        const origin = originFromRequest(request);
        return new Response(
          JSON.stringify({
            url: `${origin}/data-deletion/${confirmationCode}`,
            confirmation_code: confirmationCode,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      GET: async ({ request }) => {
        // Pomocniczy health-check: Meta nie wymaga GET, ale przydaje się w debugu.
        return new Response(
          JSON.stringify({
            ok: true,
            endpoint: new URL(request.url).pathname,
            method: "POST signed_request expected",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
