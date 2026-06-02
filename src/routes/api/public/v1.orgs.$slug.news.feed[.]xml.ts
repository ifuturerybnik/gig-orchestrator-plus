import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  resolvePublicOrg,
  pickLang,
  localize,
  escapeXml,
} from "@/lib/web-public.server";

export const Route = createFileRoute("/api/public/v1/orgs/$slug/news/feed.xml")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const org = await resolvePublicOrg(params.slug);
        if (!org) return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const lang = pickLang(url, org);
        const site = `${url.protocol}//${url.host}`;
        const base = `${site}/api/public/v1/orgs/${org.public_slug}/news`;

        const { data: orgRow } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", org.organization_id)
          .maybeSingle();
        const orgName = (orgRow?.name as string) ?? org.public_slug;

        const { data } = await supabaseAdmin
          .from("web_news")
          .select(
            "slug, title_i18n, excerpt_i18n, content_html_i18n, cover_image_url, published_at, author_name",
          )
          .eq("organization_id", org.organization_id)
          .eq("is_public", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(50);

        const items = (data ?? [])
          .map((r) => {
            const title = escapeXml(localize(r.title_i18n as Record<string, string>, lang));
            const link = `${base}/${r.slug}?lang=${lang}`;
            const desc = escapeXml(
              localize(r.excerpt_i18n as Record<string, string>, lang) ||
                localize(r.content_html_i18n as Record<string, string>, lang).replace(/<[^>]+>/g, " ").slice(0, 500),
            );
            const pub = r.published_at
              ? new Date(r.published_at as string).toUTCString()
              : new Date().toUTCString();
            const author = r.author_name ? `<author>${escapeXml(String(r.author_name))}</author>` : "";
            const enclosure = r.cover_image_url
              ? `<enclosure url="${escapeXml(String(r.cover_image_url))}" type="image/jpeg" length="0" />`
              : "";
            return `    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`${org.public_slug}:${r.slug}`)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${desc}</description>
      ${author}
      ${enclosure}
    </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(orgName)} — ${lang === "pl" ? "Aktualności" : "News"}</title>
    <link>${escapeXml(base)}</link>
    <description>${escapeXml(orgName)}</description>
    <language>${lang}</language>
${items}
  </channel>
</rss>`;
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=900",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
