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

export const Route = createFileRoute("/api/public/v1/orgs/$slug/news")({
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
        const limit = clampLimit(url.searchParams.get("limit"));
        const offset = clampLimit(url.searchParams.get("offset"), 0, 5000);
        const tag = url.searchParams.get("tag");

        let q = supabaseAdmin
          .from("web_news")
          .select(
            "id, slug, title_i18n, excerpt_i18n, content_html_i18n, cover_image_url, gallery_image_urls, tags, author_name, published_at",
          )
          .eq("organization_id", org.organization_id)
          .eq("is_public", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);
        if (tag) q = q.contains("tags", [tag]);

        const { data, error } = await q;
        if (error) return jsonResponse({ error: error.message }, cors, 500);

        const items = (data ?? []).map((r) => ({
          id: r.id,
          slug: r.slug,
          title: localize(r.title_i18n as Record<string, string>, lang),
          excerpt: localize(r.excerpt_i18n as Record<string, string>, lang),
          content_html: localize(r.content_html_i18n as Record<string, string>, lang),
          cover_image_url: r.cover_image_url,
          gallery_image_urls: r.gallery_image_urls ?? [],
          tags: r.tags ?? [],
          author_name: r.author_name,
          published_at: r.published_at,
        }));
        return jsonResponse({ lang, count: items.length, items }, cors);
      },
    },
  },
});
