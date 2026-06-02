import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  resolvePublicOrg,
  buildCorsHeaders,
  pickLang,
  localize,
  jsonResponse,
} from "@/lib/web-public.server";

export const Route = createFileRoute("/api/public/v1/orgs/$slug/gallery/$albumSlug")({
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

        const { data: album, error } = await supabaseAdmin
          .from("web_gallery_albums")
          .select("*")
          .eq("organization_id", org.organization_id)
          .eq("slug", params.albumSlug)
          .eq("is_public", true)
          .maybeSingle();
        if (error) return jsonResponse({ error: error.message }, cors, 500);
        if (!album) return jsonResponse({ error: "not_found" }, cors, 404);

        const { data: items, error: e2 } = await supabaseAdmin
          .from("web_gallery_items")
          .select("id, kind, url, url_thumb, width, height, duration_s, caption_i18n, photo_credit, sort_order")
          .eq("album_id", album.id)
          .order("sort_order");
        if (e2) return jsonResponse({ error: e2.message }, cors, 500);

        return jsonResponse(
          {
            lang,
            album: {
              id: album.id,
              slug: album.slug,
              title: localize(album.title_i18n as Record<string, string>, lang),
              description: localize(album.description_i18n as Record<string, string>, lang),
              cover_image_url: album.cover_image_url,
              event_id: album.event_id,
              published_at: album.published_at,
            },
            items: (items ?? []).map((it) => ({
              id: it.id,
              kind: it.kind,
              url: it.url,
              url_thumb: it.url_thumb,
              width: it.width,
              height: it.height,
              duration_s: it.duration_s,
              caption: localize(it.caption_i18n as Record<string, string>, lang),
              photo_credit: it.photo_credit,
              sort_order: it.sort_order,
            })),
          },
          cors,
        );
      },
    },
  },
});
