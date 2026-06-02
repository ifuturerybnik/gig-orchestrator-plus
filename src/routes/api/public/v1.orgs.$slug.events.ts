import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  resolvePublicOrg,
  buildCorsHeaders,
  pickLang,
  localize,
  jsonResponse,
  clampLimit,
} from "@/lib/web-public.server";

export const Route = createFileRoute("/api/public/v1/orgs/$slug/events")({
  server: {
    handlers: {
      OPTIONS: async ({ request, params }) => {
        const org = await resolvePublicOrg(params.slug);
        const headers = org
          ? await buildCorsHeaders(org.organization_id, request.headers.get("origin"))
          : { "Access-Control-Allow-Origin": "*" };
        return new Response(null, { status: 204, headers });
      },
      GET: async ({ request, params }) => {
        const org = await resolvePublicOrg(params.slug);
        if (!org) return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const cors = await buildCorsHeaders(org.organization_id, request.headers.get("origin"));
        const lang = pickLang(url, org);
        const limit = clampLimit(url.searchParams.get("limit"), 50);
        const offset = clampLimit(url.searchParams.get("offset"), 0, 5000);
        const upcoming = url.searchParams.get("upcoming") === "1";
        const past = url.searchParams.get("past") === "1";

        let q = supabaseAdmin
          .from("web_events")
          .select(
            "id, slug, title_i18n, description_html_i18n, cover_image_url, starts_at, ends_at, timezone, location_name_i18n, location_address, location_lat, location_lng, performers, ticket_url, ticket_price_from, currency, status",
          )
          .eq("organization_id", org.organization_id)
          .eq("is_public", true);
        if (upcoming) q = q.gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true });
        else if (past) q = q.lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false });
        else q = q.order("starts_at", { ascending: false });
        q = q.range(offset, offset + limit - 1);

        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, cors, 500);

        const items = (data ?? []).map((r) => ({
          id: r.id,
          slug: r.slug,
          title: localize(r.title_i18n as Record<string, string>, lang),
          description_html: localize(r.description_html_i18n as Record<string, string>, lang),
          cover_image_url: r.cover_image_url,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          timezone: r.timezone,
          location_name: localize(r.location_name_i18n as Record<string, string>, lang),
          location_address: r.location_address,
          location_lat: r.location_lat,
          location_lng: r.location_lng,
          performers: r.performers ?? [],
          ticket_url: r.ticket_url,
          ticket_price_from: r.ticket_price_from,
          currency: r.currency,
          status: r.status,
        }));
        return jsonResponse({ lang, count: items.length, items }, cors);
      },
    },
  },
});
