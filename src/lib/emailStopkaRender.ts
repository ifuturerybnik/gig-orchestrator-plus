// Concertivo — render stopki e-mail jako HTML zoptymalizowany pod klienty pocztowe
// (Gmail, Outlook, Apple Mail). Layout: <table> 3-kolumnowy, inline styles,
// web-safe fonty. Ported z CRM Hub i dostosowane do modelu hybrydowego
// (stopki użytkownika ORAZ stopki organizacji).

import { supabase } from '@/integrations/supabase/client';
import type { EmailStopkaPelna } from '@/hooks/useEmailStopki';
import { renderStopkaFieldIconPreview, renderEmailStopkaIconHtml, defaultStopkaIconKey } from '@/lib/emailStopkaIcons';

const STORAGE_BUCKET = 'stopki-grafiki';

/** Zwraca publiczny URL pliku w buckecie `stopki-grafiki`. */
export function stopkaGrafikaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

export function renderStopkaHtml(stopka: EmailStopkaPelna, options: { preview?: boolean } = {}): string {
  const accent = escapeAttr(stopka.kolor_akcent || '#1e40af');
  const font = escapeAttr(stopka.czcionka || 'Arial, sans-serif');
  const logoUrl = stopkaGrafikaUrl(stopka.logo_path);
  const photoUrl = stopkaGrafikaUrl(stopka.zdjecie_path);
  const hasPhoto = !!photoUrl;

  const fieldIcon = (field: 'telefon' | 'email' | 'www' | 'adres') => options.preview
    ? renderStopkaFieldIconPreview(field, accent)
    : renderEmailStopkaIconHtml(defaultStopkaIconKey(field), field, accent, 28);

  const polaSocial = stopka.pola.filter(p => p.typ === 'social' && !!p.wartosc?.trim());
  let socials: Array<{ url: string; label: string; svg: string }>;
  if (polaSocial.length > 0) {
    socials = polaSocial
      .map(p => {
        const platform = (p.etykieta || '').toLowerCase();
        const meta = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS];
        if (!meta) return null;
        return { url: p.wartosc, label: meta.label as string, svg: meta.glyph as string };
      })
      .filter((s): s is { url: string; label: string; svg: string } => !!s);
  } else {
    socials = ([
      { url: stopka.facebook_url, label: 'Facebook', svg: SOCIAL_LABEL.facebook },
      { url: stopka.instagram_url, label: 'Instagram', svg: SOCIAL_LABEL.instagram },
      { url: stopka.linkedin_url, label: 'LinkedIn', svg: SOCIAL_LABEL.linkedin },
      { url: stopka.youtube_url, label: 'YouTube', svg: SOCIAL_LABEL.youtube },
      { url: stopka.x_url, label: 'X', svg: SOCIAL_LABEL.x },
      { url: stopka.tiktok_url, label: 'TikTok', svg: SOCIAL_LABEL.tiktok },
    ] as Array<{ url: string | null; label: string; svg: string }>)
      .filter((s): s is { url: string; label: string; svg: string } => !!s.url);
  }

  const socialIcons = socials.length > 0
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr>${socials
        .map(s => `<td style="padding-right:8px;"><a href="${escapeAttr(s.url!)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(s.label)}" style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background-color:${accent};color:#ffffff;text-decoration:none;border-radius:50%;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;mso-line-height-rule:exactly;">${s.svg}</a></td>`)
        .join('')}</tr></table>`
    : '';

  const hasCompanyName = !!stopka.nazwa_firmy?.trim();
  const leftBottom = hasCompanyName
    ? `<div style="margin-top:12px;"><div style="font-size:16px;font-weight:bold;color:#222;line-height:1.2;font-family:${font};">${escapeText(stopka.nazwa_firmy!.trim())}</div></div>`
    : '';

  const leftTopCol = `<td valign="top" width="160" style="vertical-align:top;padding:0 28px 0 0;width:160px;">${logoUrl ? `<img src="${escapeAttr(logoUrl)}" alt="Logo" style="display:block;max-width:160px;max-height:80px;height:auto;border:0;outline:none;" />` : ''}</td>`;
  const leftBottomCol = `<td valign="bottom" width="160" style="vertical-align:bottom;padding:16px 28px 0 0;width:160px;">${leftBottom}</td>`;
  const middleCol = hasPhoto
    ? `<td rowspan="2" valign="top" style="vertical-align:top;padding:0 28px;width:120px;text-align:center;"><img src="${escapeAttr(photoUrl!)}" alt="" width="100" height="100" style="display:block;width:100px;height:100px;border-radius:50%;object-fit:cover;border:0;outline:none;margin:0 auto;" /></td>`
    : '';

  const telefony = stopka.pola.filter(p => p.typ === 'telefon');
  const emaile = stopka.pola.filter(p => p.typ === 'email');
  const www = stopka.pola.filter(p => p.typ === 'www');
  const polaRows: string[] = [];

  if (telefony.length > 0) {
    const lines = telefony.map(p =>
      `<div style="line-height:1.4;"><a href="tel:${escapeAttr(p.wartosc.replace(/\s+/g, ''))}" style="color:#333;text-decoration:none;">${escapeText(p.wartosc)}</a>${p.etykieta ? ` <span style="color:#888;">(${escapeText(p.etykieta)})</span>` : ''}</div>`
    ).join('');
    polaRows.push(rowWithIcon(accent, fieldIcon('telefon'), lines));
  }
  if (emaile.length > 0) {
    const lines = emaile.map(p =>
      `<div style="line-height:1.4;"><a href="mailto:${escapeAttr(p.wartosc)}" style="color:#333;text-decoration:none;">${escapeText(p.wartosc)}</a>${p.etykieta ? ` <span style="color:#888;">(${escapeText(p.etykieta)})</span>` : ''}</div>`
    ).join('');
    polaRows.push(rowWithIcon(accent, fieldIcon('email'), lines));
  }
  if (www.length > 0) {
    const lines = www.map(p => {
      const href = /^https?:\/\//i.test(p.wartosc) ? p.wartosc : `https://${p.wartosc}`;
      return `<div style="line-height:1.4;"><a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" style="color:#333;text-decoration:none;">${escapeText(p.wartosc)}</a></div>`;
    }).join('');
    polaRows.push(rowWithIcon(accent, fieldIcon('www'), lines));
  }
  if (stopka.adres_firmy?.trim()) {
    polaRows.push(rowWithIcon(accent, fieldIcon('adres'), escapeText(stopka.adres_firmy).replace(/\n/g, '<br>')));
  }

  const rightCol = `<td rowspan="2" valign="top" style="vertical-align:top;padding:0 0 0 28px;">
    ${stopka.imie_nazwisko ? `<div style="font-size:16px;font-weight:bold;color:#222;line-height:1.2;">${escapeText(stopka.imie_nazwisko)}</div>` : ''}
    ${stopka.rola ? `<div style="font-size:13px;color:#666;margin-top:2px;">${escapeText(stopka.rola)}</div>` : ''}
    <div style="height:3px;background-color:${accent};margin:8px 0;width:48px;font-size:0;line-height:0;mso-line-height-rule:exactly;border-radius:2px;">&nbsp;</div>
    ${polaRows.length > 0 ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#333;line-height:1.4;">${polaRows.join('')}</table>` : ''}
  </td>`;

  const socialsBar = socials.length > 0
    ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e5e5;">${socialIcons}</div>`
    : '';

  const tekstDodatkowy = stopka.tekst_dodatkowy?.trim()
    ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e5e5;font-size:11px;color:#888;line-height:1.4;font-family:${font};">${escapeText(stopka.tekst_dodatkowy).replace(/\n/g, '<br>')}</div>`
    : '';

  return `<div data-email-signature="${stopka.id}" style="font-family:${font};color:#333;margin-top:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${font};">
    <tr style="height:100%;">${leftTopCol}${middleCol}${rightCol}</tr>
    <tr>${leftBottomCol}</tr>
  </table>
  ${tekstDodatkowy}
  ${socialsBar}
</div>`.trim();
}

function rowWithIcon(color: string, iconHtml: string, content: string): string {
  return `<tr><td valign="middle" width="28" style="vertical-align:middle;padding:4px 10px 4px 0;width:28px;color:${color};text-align:center;line-height:0;font-size:0;mso-line-height-rule:exactly;">${iconHtml}</td><td valign="middle" style="vertical-align:middle;padding:4px 0;">${content}</td></tr>`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Marker stopki — bezpiecznie usuwa cały blok od pierwszego markera do końca. */
export const SIGNATURE_MARKER_RE = /<div\b(?=[^>]*\bdata-email-signature=)[\s\S]*$/i;

export function cleanEmailBodySignatureArtifacts(bodyHtml: string): string {
  return (bodyHtml || '').replace(SIGNATURE_MARKER_RE, '').trimEnd();
}

export function splitEmailBodyAndSignature(bodyHtml: string): { bodyHtml: string; signatureHtml: string } {
  const m = (bodyHtml || '').match(SIGNATURE_MARKER_RE);
  return {
    bodyHtml: cleanEmailBodySignatureArtifacts(bodyHtml || ''),
    signatureHtml: m?.[0]?.trim() || '',
  };
}

export function insertOrReplaceSignature(bodyHtml: string, signatureHtml: string): string {
  const cleaned = cleanEmailBodySignatureArtifacts(bodyHtml);
  const isEmpty = cleaned.replace(/<br\s*\/?>(\s|&nbsp;)*/gi, '')
    .replace(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '')
    .replace(/<div[^>]*>\s*(?:<br\s*\/?>)?\s*<\/div>/gi, '')
    .replace(/&nbsp;/g, '')
    .trim() === '';
  const prefix = isEmpty ? '<p><br></p><p><br></p>' : cleaned;
  return `${prefix}${signatureHtml}`;
}

const SOCIAL_LABEL = {
  facebook: 'f',
  instagram: 'IG',
  linkedin: 'in',
  youtube: 'YT',
  x: 'X',
  tiktok: 'TT',
};

export const SOCIAL_PLATFORMS = {
  facebook: { label: 'Facebook', glyph: SOCIAL_LABEL.facebook, placeholder: 'https://facebook.com/…' },
  instagram: { label: 'Instagram', glyph: SOCIAL_LABEL.instagram, placeholder: 'https://instagram.com/…' },
  linkedin: { label: 'LinkedIn', glyph: SOCIAL_LABEL.linkedin, placeholder: 'https://linkedin.com/in/…' },
  youtube: { label: 'YouTube', glyph: SOCIAL_LABEL.youtube, placeholder: 'https://youtube.com/@…' },
  x: { label: 'X (Twitter)', glyph: SOCIAL_LABEL.x, placeholder: 'https://x.com/…' },
  tiktok: { label: 'TikTok', glyph: SOCIAL_LABEL.tiktok, placeholder: 'https://tiktok.com/@…' },
} as const;

export type SocialPlatformKey = keyof typeof SOCIAL_PLATFORMS;
