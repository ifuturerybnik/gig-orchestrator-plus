import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolvePublicOrg, escapeXml } from "@/lib/web-public.server";

// /api/public/v1/orgs/<slug>/sitemap.xml
// Sitemap z aktualnościami, wydarzeniami i albumami galerii.
// Bazowy URL = ?base=https://example.com (wymagany do absolutnych URL-i).

export const Route = createFileRoute("/api/public/v1/orgs/$slug/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const base = (url.searchParams.get("base") || "").replace(/\/+$/, "");
        const org = await resolvePublicOrg(params.slug);
        if (!org) return new Response("Not found", { status: 404 });

        const [news, events, albums] = await Promise.all([
          supabaseAdmin
            .from("web_news")
            .select("slug, updated_at")
            .eq("organization_id", org.organization_id)
            .eq("is_public", true),
          supabaseAdmin
            .from("web_events")
            .select("slug, updated_at")
            .eq("organization_id", org.organization_id)
            .eq("is_public", true),
          supabaseAdmin
            .from("web_gallery_albums")
            .select("slug, updated_at")
            .eq("organization_id", org.organization_id)
            .eq("is_public", true),
        ]);

        const urls: string[] = [];
        const push = (kind: string, slug: string, lastmod: string | null) => {
          const loc = base
            ? `${base}/${kind}/${slug}`
            : `/api/public/v1/orgs/${escapeXml(org.public_slug)}/${kind}/${escapeXml(slug)}`;
          urls.push(
            `<url><loc>${escapeXml(loc)}</loc>${
              lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""
            }</url>`,
          );
        };
        (news.data ?? []).forEach((r) => push("aktualnosci", r.slug as string, r.updated_at as string));
        (events.data ?? []).forEach((r) => push("wydarzenia", r.slug as string, r.updated_at as string));
        (albums.data ?? []).forEach((r) => push("galeria", r.slug as string, r.updated_at as string));

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=3600",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
