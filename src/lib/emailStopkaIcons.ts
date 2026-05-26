// Concertivo — biblioteka ikon do stopek e-mail.
// Ported 1:1 z CRM Hub. Renderuje ikony w dwóch trybach:
//   • preview (UI w aplikacji) — kolorowa maska CSS na PNG-u
//   • email   (wysyłka SMTP)   — email-safe HTML (tabela + unicode glyph)
// Powód: klienty pocztowe (Gmail/Outlook) nie obsługują mask-image ani
// kolorowania inline SVG.

export type StopkaIconField = 'telefon' | 'email' | 'www' | 'adres';

export type EmailStopkaIconOption = {
  key: string;
  label: string;
  field: StopkaIconField;
};

type IconMeta = { key: string; label: string; field: StopkaIconField; glyph: string };

const SVG_VIEWBOX = '0 0 50 50';

const META: IconMeta[] = [
  { key: 'phone-handset', label: 'Słuchawka klasyczna', field: 'telefon', glyph: 'handset' },
  { key: 'phone-handset-thick', label: 'Słuchawka gruba', field: 'telefon', glyph: 'handset-thick' },
  { key: 'phone-handset-solid', label: 'Słuchawka pełna', field: 'telefon', glyph: 'handset-solid' },
  { key: 'phone-handset-filled', label: 'Słuchawka wypełniona', field: 'telefon', glyph: 'handset-filled' },
  { key: 'phone-mobile', label: 'Telefon komórkowy', field: 'telefon', glyph: 'mobile' },
  { key: 'phone-mobile-solid', label: 'Smartfon pełny', field: 'telefon', glyph: 'mobile-solid' },
  { key: 'phone-office', label: 'Telefon biurowy', field: 'telefon', glyph: 'office' },
  { key: 'phone-headset', label: 'Zestaw słuchawkowy', field: 'telefon', glyph: 'headset' },
  { key: 'phone-headphones', label: 'Słuchawki', field: 'telefon', glyph: 'headphones' },
  { key: 'phone-dial', label: 'Tarcza obrotowa', field: 'telefon', glyph: 'dial' },
  { key: 'phone-ring-bell', label: 'Dzwonek', field: 'telefon', glyph: 'ring-bell' },
  { key: 'phone-plus', label: 'Dodaj telefon', field: 'telefon', glyph: 'plus' },
  { key: 'phone-speech', label: 'Rozmowa', field: 'telefon', glyph: 'speech' },
  { key: 'phone-fax', label: 'Faks', field: 'telefon', glyph: 'fax' },
  { key: 'phone-signal', label: 'Sygnał', field: 'telefon', glyph: 'signal' },
  { key: 'phone-call-in', label: 'Połączenie przychodzące', field: 'telefon', glyph: 'call-in' },
  { key: 'phone-call-out', label: 'Połączenie wychodzące', field: 'telefon', glyph: 'call-out' },
  { key: 'phone-fav', label: 'Ulubiony kontakt', field: 'telefon', glyph: 'fav' },
  { key: 'phone-t-letter', label: 'Litera T', field: 'telefon', glyph: 't-letter' },
  { key: 'phone-talk', label: 'Chmurki rozmowy', field: 'telefon', glyph: 'talk' },
  { key: 'phone-handset-up', label: 'Słuchawka pionowa', field: 'telefon', glyph: 'handset-up' },
  { key: 'mail-envelope', label: 'Koperta', field: 'email', glyph: 'envelope' },
  { key: 'mail-envelope-bold', label: 'Koperta gruba', field: 'email', glyph: 'envelope-bold' },
  { key: 'mail-envelope-open', label: 'Koperta otwarta', field: 'email', glyph: 'envelope-open' },
  { key: 'mail-envelope-solid', label: 'Koperta pełna', field: 'email', glyph: 'envelope-solid' },
  { key: 'mail-envelope-at', label: 'Koperta z @', field: 'email', glyph: 'envelope-at' },
  { key: 'mail-envelope-text', label: 'Koperta z tekstem', field: 'email', glyph: 'envelope-text' },
  { key: 'mail-envelope-check', label: 'Koperta - przeczytano', field: 'email', glyph: 'envelope-check' },
  { key: 'mail-envelope-star', label: 'Koperta - ulubione', field: 'email', glyph: 'envelope-star' },
  { key: 'mail-envelope-arrow', label: 'Koperta ze strzałką', field: 'email', glyph: 'envelope-arrow' },
  { key: 'mail-send-arrow', label: 'Wyślij e-mail', field: 'email', glyph: 'send-arrow' },
  { key: 'mail-at', label: 'Symbol @', field: 'email', glyph: 'at' },
  { key: 'mail-at-solid', label: '@ pełne', field: 'email', glyph: 'at-solid' },
  { key: 'mail-mini-at', label: 'Mini @', field: 'email', glyph: 'mini-at' },
  { key: 'mail-plane', label: 'Papierowy samolot', field: 'email', glyph: 'plane' },
  { key: 'mail-stack', label: 'Stos kopert', field: 'email', glyph: 'stack' },
  { key: 'mail-mailbox', label: 'Skrzynka pocztowa', field: 'email', glyph: 'mailbox' },
  { key: 'mail-inbox', label: 'Skrzynka odbiorcza', field: 'email', glyph: 'inbox' },
  { key: 'mail-bubble', label: 'Wiadomość', field: 'email', glyph: 'bubble' },
  { key: 'mail-paper', label: 'Dokument', field: 'email', glyph: 'paper' },
  { key: 'mail-mail-dot', label: 'Powiadomienie', field: 'email', glyph: 'mail-dot' },
  { key: 'www-globe', label: 'Globus', field: 'www', glyph: 'globe' },
  { key: 'www-globe-meridian', label: 'Globus z południkami', field: 'www', glyph: 'globe-meridian' },
  { key: 'www-globe-grid', label: 'Globus z siatką', field: 'www', glyph: 'globe-grid' },
  { key: 'www-globe-solid', label: 'Globus pełny', field: 'www', glyph: 'globe-solid' },
  { key: 'www-globe-disc', label: 'Globus dysk', field: 'www', glyph: 'globe-disc' },
  { key: 'www-globe-dots', label: 'Orbita', field: 'www', glyph: 'globe-dots' },
  { key: 'www-wifi-globe', label: 'Globus z falami', field: 'www', glyph: 'wifi-globe' },
  { key: 'www-cursor', label: 'Kursor', field: 'www', glyph: 'cursor' },
  { key: 'www-cursor-dot', label: 'Klik', field: 'www', glyph: 'cursor-dot' },
  { key: 'www-link', label: 'Link', field: 'www', glyph: 'link' },
  { key: 'www-browser', label: 'Przeglądarka', field: 'www', glyph: 'browser' },
  { key: 'www-monitor', label: 'Monitor', field: 'www', glyph: 'monitor' },
  { key: 'www-compass', label: 'Kompas WWW', field: 'www', glyph: 'compass' },
  { key: 'www-arrow', label: 'Strzałka', field: 'www', glyph: 'arrow' },
  { key: 'www-external', label: 'Otwórz w nowym oknie', field: 'www', glyph: 'external' },
  { key: 'www-hash', label: 'Hashtag', field: 'www', glyph: 'hash' },
  { key: 'www-dot-com', label: 'Domena .com', field: 'www', glyph: 'dot-com' },
  { key: 'www-www-text', label: 'WWW', field: 'www', glyph: 'www-text' },
  { key: 'www-network', label: 'Sieć', field: 'www', glyph: 'network' },
  { key: 'www-slashes', label: 'Ukośniki URL', field: 'www', glyph: 'slashes' },
  { key: 'addr-pin', label: 'Pinezka pełna', field: 'adres', glyph: 'pin' },
  { key: 'addr-pin-outline', label: 'Pinezka kontur', field: 'adres', glyph: 'pin-outline' },
  { key: 'addr-pin-dot', label: 'Pinezka z kropką', field: 'adres', glyph: 'pin-dot' },
  { key: 'addr-pin-white', label: 'Pinezka biała', field: 'adres', glyph: 'pin-white' },
  { key: 'addr-location', label: 'Lokalizacja', field: 'adres', glyph: 'location' },
  { key: 'addr-crosshair', label: 'Cel', field: 'adres', glyph: 'crosshair' },
  { key: 'addr-house', label: 'Dom', field: 'adres', glyph: 'house' },
  { key: 'addr-house-chimney', label: 'Dom z kominem', field: 'adres', glyph: 'house-chimney' },
  { key: 'addr-office', label: 'Biurowiec', field: 'adres', glyph: 'office' },
  { key: 'addr-building', label: 'Budynki', field: 'adres', glyph: 'building' },
  { key: 'addr-hq', label: 'Siedziba', field: 'adres', glyph: 'hq' },
  { key: 'addr-shop', label: 'Sklep', field: 'adres', glyph: 'shop' },
  { key: 'addr-map', label: 'Mapa', field: 'adres', glyph: 'map' },
  { key: 'addr-map-pin', label: 'Pinezka na mapie', field: 'adres', glyph: 'map-pin' },
  { key: 'addr-globe-pin', label: 'Pinezka na globie', field: 'adres', glyph: 'globe-pin' },
  { key: 'addr-flag', label: 'Flaga', field: 'adres', glyph: 'flag' },
  { key: 'addr-compass', label: 'Kompas', field: 'adres', glyph: 'compass' },
  { key: 'addr-route', label: 'Trasa', field: 'adres', glyph: 'route' },
  { key: 'addr-radar', label: 'Radar', field: 'adres', glyph: 'radar' },
  { key: 'addr-address-card', label: 'Karta adresu', field: 'adres', glyph: 'address-card' },
];

export const EMAIL_STOPKA_ICON_OPTIONS: EmailStopkaIconOption[] = META.map(({ key, label, field }) => ({ key, label, field }));

const ICON_META_BY_KEY = new Map(META.map(icon => [icon.key, icon]));

export function defaultStopkaIconKey(field: StopkaIconField): string {
  if (field === 'telefon') return 'phone-handset';
  if (field === 'email') return 'mail-envelope';
  if (field === 'www') return 'www-globe';
  return 'addr-pin';
}

/**
 * URL-e PNG-ów do podglądu w UI (kolorowane maską CSS).
 * Pliki należy umieścić w public/email-icons/ (telefon.png, email.png, www.png, adres.png).
 * Wystarczą sylwetki w czerni — kolor nakłada CSS mask-image.
 */
const STOPKA_FIELD_ICON_PREVIEW_URL: Record<StopkaIconField, string> = {
  telefon: '/email-icons/telefon.png',
  email: '/email-icons/email.png',
  www: '/email-icons/www.png',
  adres: '/email-icons/adres.png',
};

export function renderStopkaFieldIconPreview(field: StopkaIconField, color: string, size = 24): string {
  const url = escapeAttr(STOPKA_FIELD_ICON_PREVIEW_URL[field]);
  const safeColor = escapeAttr(color || '#1e40af');
  return `<span aria-hidden="true" style="display:inline-block;width:${size}px;height:${size}px;background-color:${safeColor};vertical-align:middle;-webkit-mask-image:url('${url}');mask-image:url('${url}');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;"></span>`;
}

export function normalizeEmailStopkaIconKey(key: string | null | undefined, fallbackField: StopkaIconField): string {
  if (key && ICON_META_BY_KEY.has(key)) return key;
  if (typeof key === 'string') {
    if (key.startsWith('phone-')) return 'phone-handset';
    if (key.startsWith('mail-') || key.startsWith('envelope')) return 'mail-envelope';
    if (key.startsWith('www-') || key.startsWith('globe-') || key.startsWith('web-')) return 'www-globe';
    if (key.startsWith('addr-') || key.startsWith('location-') || key.startsWith('pin-')) return 'addr-pin';
  }
  return defaultStopkaIconKey(fallbackField);
}

export function renderEmailStopkaIconSvg(
  key: string | null | undefined,
  fallbackField: StopkaIconField,
  size = 24,
): string {
  const normalizedKey = normalizeEmailStopkaIconKey(key, fallbackField);
  const icon = ICON_META_BY_KEY.get(normalizedKey) ?? ICON_META_BY_KEY.get(defaultStopkaIconKey(fallbackField));
  const body = renderIconBody(icon?.field ?? fallbackField, icon?.glyph ?? 'pin');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SVG_VIEWBOX}" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:${size}px;height:${size}px;color:currentColor;overflow:visible;">${body}</svg>`;
}

/**
 * Email-safe ikona: tabela + okrąg + unicode glyph. Działa w Gmail/Outlook,
 * gdzie inline SVG ani mask-image nie są kolorowane.
 */
export function renderEmailStopkaIconHtml(
  key: string | null | undefined,
  fallbackField: StopkaIconField,
  color: string,
  outputSize = 24,
): string {
  const safeColor = escapeAttr(color || '#1e40af');
  const symbol = emailSafeIconSymbol(key, fallbackField);
  const fontSize = symbol.length > 2 ? Math.max(7, Math.round(outputSize * 0.32)) : Math.max(12, Math.round(outputSize * 0.58));
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${outputSize}" height="${outputSize}" style="border-collapse:collapse;border-spacing:0;width:${outputSize}px;height:${outputSize}px;margin:0;"><tr><td width="${outputSize}" height="${outputSize}" align="center" valign="middle" style="width:${outputSize}px;height:${outputSize}px;min-width:${outputSize}px;max-width:${outputSize}px;border:2px solid ${safeColor};border-radius:50%;color:${safeColor};font-family:Arial,Helvetica,sans-serif;font-size:${fontSize}px;font-weight:bold;line-height:${outputSize - 4}px;text-align:center;vertical-align:middle;mso-line-height-rule:exactly;text-decoration:none;">${symbol}</td></tr></table>`;
}

function emailSafeIconSymbol(key: string | null | undefined, fallbackField: StopkaIconField): string {
  const normalizedKey = normalizeEmailStopkaIconKey(key, fallbackField);
  const icon = ICON_META_BY_KEY.get(normalizedKey);
  const field = icon?.field ?? fallbackField;
  const glyph = icon?.glyph ?? '';
  if (field === 'telefon') {
    if (glyph.includes('mobile')) return '&#9633;';
    if (glyph.includes('headset') || glyph.includes('headphones')) return '&#9835;';
    if (glyph.includes('fax')) return 'FX';
    if (glyph.includes('plus')) return '+';
    return '&#9742;&#65038;';
  }
  if (field === 'email') {
    if (glyph.includes('at')) return '@';
    if (glyph.includes('send') || glyph.includes('plane')) return '&#9658;';
    if (glyph.includes('check')) return '&#10003;';
    return '&#9993;&#65038;';
  }
  if (field === 'www') {
    if (glyph.includes('link')) return '&#8734;';
    if (glyph.includes('cursor') || glyph.includes('arrow') || glyph.includes('external')) return '&#8599;';
    if (glyph.includes('www') || glyph.includes('dot-com')) return 'www';
    return '&#9711;';
  }
  if (glyph.includes('house') || glyph.includes('office') || glyph.includes('building') || glyph.includes('hq') || glyph.includes('shop')) return '&#8962;';
  if (glyph.includes('map') || glyph.includes('route')) return '&#9636;';
  if (glyph.includes('flag')) return '&#9873;&#65038;';
  return '&#9679;';
}

function renderIconBody(field: StopkaIconField, glyph: string): string {
  const frame = `<circle cx="25" cy="25" r="21"/>`;
  if (field === 'telefon') return frame + phoneGlyph(glyph);
  if (field === 'email') return frame + mailGlyph(glyph);
  if (field === 'www') return frame + wwwGlyph(glyph);
  return frame + addressGlyph(glyph);
}

function phoneBase(extra = ''): string {
  return `<path d="M18 17c2.5 7 8 12.5 15 15l4-4c.8-.8.9-2 .2-2.9l-3-4c-.7-.9-1.9-1.2-2.9-.7l-3 1.5a18 18 0 0 1-7.2-7.2l1.5-3c.5-1 .2-2.2-.7-2.9l-4-3c-.9-.7-2.1-.6-2.9.2l-4 4Z"/>${extra}`;
}
function envelopeBase(extra = ''): string {
  return `<rect x="13" y="17" width="24" height="17" rx="3"/><path d="m14 19 11 8 11-8"/>${extra}`;
}
function globeBase(extra = ''): string {
  return `<circle cx="25" cy="25" r="12"/><path d="M13 25h24M25 13c4 4.5 4 19.5 0 24M25 13c-4 4.5-4 19.5 0 24"/>${extra}`;
}
function pinBase(extra = ''): string {
  return `<path d="M25 37s10-9.4 10-17a10 10 0 0 0-20 0c0 7.6 10 17 10 17Z"/><circle cx="25" cy="20" r="3"/>${extra}`;
}

function phoneGlyph(glyph: string): string {
  switch (glyph) {
    case 'handset-thick': return phoneBase(`<path d="M16 19c3.2 7.2 8.8 12.8 16 16" stroke-width="4.2"/>`);
    case 'handset-solid': return phoneBase(`<path d="M20 23c2 3.2 4 5.2 7.2 7.2" stroke-width="4"/>`);
    case 'handset-filled': return phoneBase(`<circle cx="35" cy="15" r="2.2" fill="currentColor" stroke="none"/>`);
    case 'mobile': return `<rect x="17" y="12" width="16" height="26" rx="4"/><path d="M22 16h6M24 34h2"/>`;
    case 'mobile-solid': return `<rect x="17" y="12" width="16" height="26" rx="4"/><path d="M20 29h10M24 34h2"/><circle cx="25" cy="21" r="3"/>`;
    case 'office': return `<path d="M16 31h18v5H16zM18 20h14v11H18zM21 17h8M21 24h2M27 24h2M21 28h8"/>`;
    case 'headset': return `<path d="M15 27v-4a10 10 0 0 1 20 0v4M15 27h5v8h-5zM30 27h5v6h-5zM30 35h-5"/>`;
    case 'headphones': return `<path d="M14 27v-3a11 11 0 0 1 22 0v3M14 27h5v8h-5zM31 27h5v8h-5z"/>`;
    case 'dial': return `<circle cx="25" cy="26" r="10"/><circle cx="25" cy="26" r="3"/><path d="M18 18h14M18 34h14M17 22l16 8M33 22l-16 8"/>`;
    case 'ring-bell': return phoneBase(`<path d="M13 15c-2 2-3 4-3 7M37 15c2 2 3 4 3 7"/>`);
    case 'plus': return phoneBase(`<path d="M34 12v8M30 16h8"/>`);
    case 'speech': return phoneBase(`<path d="M31 13h8v7h-4l-3 3v-3h-1z"/>`);
    case 'fax': return `<path d="M17 18v-5h15v8M16 24h18a3 3 0 0 1 3 3v8H13v-8a3 3 0 0 1 3-3ZM18 31h14M20 35h10M32 28h1"/>`;
    case 'signal': return phoneBase(`<path d="M32 18c2 1.2 3.4 3 4 5M36 14c3.6 2.2 6 5.4 7 9"/>`);
    case 'call-in': return phoneBase(`<path d="M37 14H27M27 14v10M27 14l10 10"/>`);
    case 'call-out': return phoneBase(`<path d="M28 23h10M38 23V13M38 23 28 13"/>`);
    case 'fav': return phoneBase(`<path d="m35 13 1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z"/>`);
    case 't-letter': return phoneBase(`<path d="M30 14h10M35 14v10"/>`);
    case 'talk': return `<path d="M15 17h19v12H22l-5 5v-5h-2z"/><path d="M25 34h9l4 4v-4h2V23h-5"/>`;
    case 'handset-up': return `<path d="M19 34c7-2.5 12.5-8 15-15l-4-4c-.8-.8-2-.9-2.9-.2l-4 3c-.9.7-1.2 1.9-.7 2.9l1.5 3a18 18 0 0 1-7.2 7.2l-3-1.5c-1-.5-2.2-.2-2.9.7l-3 4c-.7.9-.6 2.1.2 2.9l4 4Z"/>`;
    default: return phoneBase();
  }
}

function mailGlyph(glyph: string): string {
  switch (glyph) {
    case 'envelope-bold': return `<rect x="13" y="17" width="24" height="17" rx="3" stroke-width="4"/><path d="m14 19 11 8 11-8" stroke-width="3.4"/>`;
    case 'envelope-open': return `<path d="M14 24 25 16l11 8v11H14z"/><path d="m14 24 11 8 11-8"/>`;
    case 'envelope-solid': return envelopeBase(`<path d="M16 32h18" stroke-width="4"/>`);
    case 'envelope-at': return envelopeBase(`<path d="M27.5 25a3 3 0 1 1-1.5-2.6v4.2c2.5.7 4.5-.9 4.5-3.3a5.6 5.6 0 1 0-2.1 4.4"/>`);
    case 'envelope-text': return envelopeBase(`<path d="M18 29h10M18 32h7"/>`);
    case 'envelope-check': return envelopeBase(`<path d="m28 31 3 3 6-7"/>`);
    case 'envelope-star': return envelopeBase(`<path d="m32 27 1 2 2.2.3-1.6 1.6.4 2.1-2-1-2 1 .4-2.1-1.6-1.6 2.2-.3z"/>`);
    case 'envelope-arrow': return envelopeBase(`<path d="M32 29h6M36 25l4 4-4 4"/>`);
    case 'send-arrow': return `<path d="M13 18 38 12 32 37l-6-10-10-4 13-4"/>`;
    case 'at': return `<path d="M31 26a6 6 0 1 1-2-4.5v7c4 1.2 7-1.4 7-5.3a10.5 10.5 0 1 0-4 8.3"/>`;
    case 'at-solid': return `<circle cx="25" cy="25" r="10"/><path d="M31 25a6 6 0 1 1-2-4.5v7c3.8 1 6-1 6-4.5"/>`;
    case 'mini-at': return envelopeBase(`<path d="M28 26a3 3 0 1 1-1-2.2v3.8c2 .5 3.5-.7 3.5-2.7"/>`);
    case 'plane': return `<path d="M13 18 37 13 31 36l-5-9-9-4 12-4"/><path d="m26 27 5-8"/>`;
    case 'stack': return `<rect x="13" y="20" width="24" height="15" rx="3"/><path d="m14 22 11 8 11-8M16 17h18M19 13h12"/>`;
    case 'mailbox': return `<path d="M14 28h20v9H14zM14 28a10 10 0 0 1 20 0M24 28v9M36 18h4v8"/>`;
    case 'inbox': return `<path d="M15 18h20l3 17H12z"/><path d="M17 29h6l2 3 2-3h6"/>`;
    case 'bubble': return `<path d="M15 17h20v15H23l-6 5v-5h-2z"/><path d="M20 23h10M20 28h7"/>`;
    case 'paper': return `<path d="M18 13h11l6 6v18H18zM29 13v7h6M22 26h9M22 31h7"/>`;
    case 'mail-dot': return envelopeBase(`<circle cx="36" cy="15" r="3" fill="currentColor" stroke="none"/>`);
    default: return envelopeBase();
  }
}

function wwwGlyph(glyph: string): string {
  switch (glyph) {
    case 'globe-meridian': return globeBase(`<path d="M17 17c5 3 11 3 16 0M17 33c5-3 11-3 16 0"/>`);
    case 'globe-grid': return globeBase(`<path d="M15 20h20M15 30h20"/>`);
    case 'globe-solid': return globeBase(`<circle cx="25" cy="25" r="5"/>`);
    case 'globe-disc': return `<circle cx="25" cy="25" r="12"/><path d="M16 20h18M16 30h18M20 14c-2 7-2 15 0 22M30 14c2 7 2 15 0 22"/>`;
    case 'globe-dots': return globeBase(`<circle cx="17" cy="25" r="1.5" fill="currentColor" stroke="none"/><circle cx="25" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="33" cy="25" r="1.5" fill="currentColor" stroke="none"/>`);
    case 'wifi-globe': return globeBase(`<path d="M19 13c4-2 8-2 12 0M15 9c6-3.5 14-3.5 20 0"/>`);
    case 'cursor': return `<path d="M17 14v23l6-6 4 7 5-3-4-7h8z"/>`;
    case 'cursor-dot': return `<path d="M17 14v23l6-6 4 7 5-3-4-7h8z"/><circle cx="35" cy="15" r="2.5" fill="currentColor" stroke="none"/>`;
    case 'link': return `<path d="M22 18h-3a7 7 0 0 0 0 14h5M28 18h3a7 7 0 0 1 0 14h-5M21 25h8"/>`;
    case 'browser': return `<rect x="13" y="16" width="24" height="19" rx="3"/><path d="M13 22h24M18 19h.1M23 19h.1"/>`;
    case 'monitor': return `<rect x="13" y="16" width="24" height="17" rx="2"/><path d="M21 37h8M25 33v4"/>`;
    case 'compass': return `<circle cx="25" cy="25" r="12"/><path d="m29 18-3 10-8 4 3-10z"/>`;
    case 'arrow': return globeBase(`<path d="M27 20h8v8M35 20 24 31"/>`);
    case 'external': return `<rect x="15" y="18" width="17" height="17" rx="2"/><path d="M27 15h9v9M36 15 24 27"/>`;
    case 'hash': return `<path d="M21 16 18 34M31 16l-3 18M17 22h18M15 29h18"/>`;
    case 'dot-com': return `<path d="M14 27h2M20 27h2M26 27h2"/><path d="M33 20c-7 0-7 10 0 10M37 25a4 4 0 1 0 0-.1M41 21v8"/>`;
    case 'www-text': return `<path d="m14 20 3 12 4-9 4 9 4-12M31 20l3 12 4-9 4 9 4-12"/>`;
    case 'network': return `<circle cx="18" cy="20" r="3"/><circle cx="32" cy="20" r="3"/><circle cx="25" cy="32" r="3"/><path d="M21 21h8M20 23l4 7M30 23l-4 7"/>`;
    case 'slashes': return `<path d="M21 17 15 33M29 17l-6 16M35 17l-6 16"/>`;
    default: return globeBase();
  }
}

function addressGlyph(glyph: string): string {
  switch (glyph) {
    case 'pin-outline': return pinBase();
    case 'pin-dot': return pinBase(`<circle cx="35" cy="15" r="2.5" fill="currentColor" stroke="none"/>`);
    case 'pin-white': return `<path d="M25 37s10-9.4 10-17a10 10 0 0 0-20 0c0 7.6 10 17 10 17Z"/><circle cx="25" cy="20" r="5"/>`;
    case 'location': return `<path d="M25 38V25M25 25l9-12-9 4-9-4z"/>`;
    case 'crosshair': return `<circle cx="25" cy="25" r="10"/><circle cx="25" cy="25" r="3"/><path d="M25 12v6M25 32v6M12 25h6M32 25h6"/>`;
    case 'house': return `<path d="M15 25 25 16l10 9v12H18V25"/><path d="M23 37v-8h5v8"/>`;
    case 'house-chimney': return `<path d="M15 25 25 16l10 9v12H18V25"/><path d="M30 18v-5h4v9M23 37v-8h5v8"/>`;
    case 'office': return `<path d="M17 37V15h16v22M21 20h3M28 20h3M21 25h3M28 25h3M21 30h3M28 30h3M23 37v-4h4v4"/>`;
    case 'building': return `<path d="M15 37V21h10v16M25 37V15h10v22M18 25h3M18 30h3M29 20h3M29 25h3M29 30h3"/>`;
    case 'hq': return `<path d="M16 37V18l9-5 9 5v19M21 22h8M21 27h8M21 32h8"/><path d="M25 13v24"/>`;
    case 'shop': return `<path d="M16 23h18l-2-7H18zM18 23v14h14V23M21 37v-7h8v7"/><path d="M16 23c1.5 4 5 4 7 0 2 4 6 4 8 0 1.5 4 5 4 7 0"/>`;
    case 'map': return `<path d="m15 18 7-3 7 3 7-3v20l-7 3-7-3-7 3zM22 15v20M29 18v20"/>`;
    case 'map-pin': return `<path d="m14 18 7-3 7 3 8-3v20l-8 3-7-3-7 3z"/><path d="M27 31s6-5.6 6-10a6 6 0 0 0-12 0c0 4.4 6 10 6 10Z"/><circle cx="27" cy="21" r="1.8"/>`;
    case 'globe-pin': return `<circle cx="25" cy="25" r="11"/><path d="M14 25h22M25 14c3.2 4.5 3.2 17.5 0 22M32 33s5-4.4 5-8a5 5 0 0 0-10 0c0 3.6 5 8 5 8Z"/>`;
    case 'flag': return `<path d="M18 37V14M18 15h16l-3 6 3 6H18"/>`;
    case 'compass': return `<circle cx="25" cy="25" r="12"/><path d="m30 17-3 11-9 5 3-11z"/>`;
    case 'route': return `<circle cx="17" cy="18" r="3"/><circle cx="33" cy="32" r="3"/><path d="M20 18h7a5 5 0 0 1 0 10h-4a5 5 0 0 0 0 10h7"/>`;
    case 'radar': return `<circle cx="25" cy="25" r="4"/><circle cx="25" cy="25" r="9"/><path d="M25 25 35 15M16 34a13 13 0 0 1 18-18"/>`;
    case 'address-card': return `<rect x="14" y="17" width="22" height="18" rx="3"/><circle cx="21" cy="25" r="3"/><path d="M18 31c2-3 5-3 7 0M29 23h4M29 28h4"/>`;
    default: return pinBase(`<path d="M20 34h10"/>`);
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
