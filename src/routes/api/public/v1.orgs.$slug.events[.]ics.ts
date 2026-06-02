import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  resolvePublicOrg,
  pickLang,
  localize,
} from "@/lib/web-public.server";

function fmtIcsDate(iso: string): string {
  // YYYYMMDDTHHMMSSZ
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsEscape(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  // RFC 5545: lines max 75 octets, continuation with CRLF + space
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return out.join("\r\n");
}

export const Route = createFileRoute("/api/public/v1/orgs/$slug/events.ics")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const org = await resolvePublicOrg(params.slug);
        if (!org) return new Response("Not found", { status: 404 });
        const url = new URL(request.url);
        const lang = pickLang(url, org);

        const { data } = await supabaseAdmin
          .from("web_events")
          .select(
            "id, slug, title_i18n, description_html_i18n, starts_at, ends_at, location_name_i18n, location_address, ticket_url, status, updated_at",
          )
          .eq("organization_id", org.organization_id)
          .eq("is_public", true)
          .order("starts_at", { ascending: true })
          .limit(500);

        const events = (data ?? []).map((r) => {
          const title = localize(r.title_i18n as Record<string, string>, lang);
          const descHtml = localize(r.description_html_i18n as Record<string, string>, lang);
          const desc = descHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const loc = [
            localize(r.location_name_i18n as Record<string, string>, lang),
            r.location_address as string | null,
          ]
            .filter(Boolean)
            .join(", ");
          const lines: string[] = [
            "BEGIN:VEVENT",
            `UID:${r.id}@concertivo`,
            `DTSTAMP:${fmtIcsDate((r.updated_at as string) ?? new Date().toISOString())}`,
            `DTSTART:${fmtIcsDate(r.starts_at as string)}`,
          ];
          if (r.ends_at) lines.push(`DTEND:${fmtIcsDate(r.ends_at as string)}`);
          lines.push(`SUMMARY:${icsEscape(title)}`);
          if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
          if (loc) lines.push(`LOCATION:${icsEscape(loc)}`);
          if (r.ticket_url) lines.push(`URL:${icsEscape(String(r.ticket_url))}`);
          if (r.status === "cancelled") lines.push("STATUS:CANCELLED");
          lines.push("END:VEVENT");
          return lines.map(fold).join("\r\n");
        });

        const body = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Concertivo//Public Events//EN",
          "CALSCALE:GREGORIAN",
          ...events,
          "END:VCALENDAR",
        ].join("\r\n");

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=900",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
