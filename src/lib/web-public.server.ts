// Helpers wspólne dla publicznych endpointów /api/public/v1/orgs/<slug>/...
// Resolver organizacji po publicznym slugu + dynamiczne CORS na podstawie
// org_public_domains. Działa przez supabaseAdmin (RLS bypass) — to jest
// świadomy, publiczny odczyt opublikowanych treści.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicOrg = {
  organization_id: string;
  public_slug: string;
  default_lang: "pl" | "en";
  available_langs: string[];
};

export async function resolvePublicOrg(slug: string): Promise<PublicOrg | null> {
  const clean = (slug || "").toLowerCase().trim();
  if (!clean) return null;
  const { data } = await supabaseAdmin
    .from("org_public_settings")
    .select("organization_id, public_slug, default_lang, available_langs, is_published")
    .eq("public_slug", clean)
    .eq("is_published", true)
    .maybeSingle();
  if (!data) return null;
  return {
    organization_id: data.organization_id as string,
    public_slug: data.public_slug as string,
    default_lang: ((data.default_lang as "pl" | "en") ?? "pl"),
    available_langs: (data.available_langs as string[]) ?? ["pl", "en"],
  };
}

export async function buildCorsHeaders(
  organizationId: string,
  origin: string | null,
): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("org_public_domains")
    .select("domain")
    .eq("organization_id", organizationId);
  const domains = ((data ?? []) as Array<{ domain: string }>).map((r) => r.domain);
  let allow = "*";
  if (domains.length > 0) {
    if (origin) {
      try {
        const host = new URL(origin).hostname.toLowerCase();
        if (domains.some((d) => host === d || host.endsWith(`.${d}`))) {
          allow = origin;
        } else {
          allow = ""; // not allowed
        }
      } catch {
        allow = "";
      }
    } else {
      allow = "";
    }
  }
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (allow) h["Access-Control-Allow-Origin"] = allow;
  return h;
}

export function pickLang(
  url: URL,
  org: PublicOrg,
): "pl" | "en" {
  const q = (url.searchParams.get("lang") || "").toLowerCase();
  if (q === "pl" || q === "en") return q;
  return org.default_lang;
}

export function localize(
  i18n: Record<string, string> | null | undefined,
  lang: "pl" | "en",
  fallbackLang: "pl" | "en" = "pl",
): string {
  if (!i18n) return "";
  return i18n[lang] || i18n[fallbackLang] || Object.values(i18n)[0] || "";
}

export function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function jsonResponse(body: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      ...headers,
    },
  });
}

export function clampLimit(input: string | null, def = 20, max = 100): number {
  const n = parseInt(input || "", 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, max);
  return def;
}
