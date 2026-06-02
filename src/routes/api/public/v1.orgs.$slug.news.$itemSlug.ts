import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  resolvePublicOrg,
  buildCorsHeaders,
  pickLang,
  localize,
  jsonResponse,
} from "@/lib/web-public.server";

export const Route = createFileRoute("/api/public/v1/orgs/$slug/news/$itemSlug")({
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

        const { data, error } = await supabaseAdmin
          .from("web_news")
          .select("*")
          .eq("organization_id", org.organization_id)
          .eq("slug", params.itemSlug)
          .eq("is_public", true)
          .maybeSingle();
        if (error) return jsonResponse({ error: error.message }, cors, 500);
        if (!data) return jsonResponse({ error: "not_found" }, cors, 404);

        const item = {
          id: data.id,
          slug: data.slug,
          title: localize(data.title_i18n as Record<string, string>, lang),
          excerpt: localize(data.excerpt_i18n as Record<string, string>, lang),
          content_html: localize(data.content_html_i18n as Record<string, string>, lang),
          cover_image_url: data.cover_image_url,
          gallery_image_urls: data.gallery_image_urls ?? [],
          tags: data.tags ?? [],
          author_name: data.author_name,
          published_at: data.published_at,
        };
        return jsonResponse({ lang, item }, cors);
      },
    },
  },
});
