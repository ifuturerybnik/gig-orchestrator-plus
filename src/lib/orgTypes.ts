// ============================================================================
// Concertivo — typy organizacji + rodzaje artysty
// ============================================================================
// Stabilne ID (snake_case) trafiają do DB. Etykiety lokalizowane przez i18next
// pod kluczami:
//   organizations.type.<id>
//   organizations.artist_kind.<id>

export const ORG_TYPES = [
  "artist",
  "event_company",
  "event_organizer",
  "stage_rental",
  "lighting_rental",
  "sound_rental",
  "led_rental",
  "pyro",
  "transport",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];

export const ARTIST_KINDS = [
  "band",
  "solo",
  "cabaret",
  "standup",
  "dj",
  "orchestra",
  "choir",
  "dance",
  "fire_show",
  "illusionist",
  "kids_show",
  "host",
  "other",
] as const;

export type ArtistKind = (typeof ARTIST_KINDS)[number];

/** Typy organizacji, które wymagają danych firmy (NIP, adres, nazwa). */
export const COMPANY_ORG_TYPES: readonly OrgType[] = [
  "event_company",
  "event_organizer",
  "stage_rental",
  "lighting_rental",
  "sound_rental",
  "led_rental",
  "pyro",
  "transport",
] as const;

export function isCompanyType(t: OrgType): boolean {
  return COMPANY_ORG_TYPES.includes(t);
}

export function hasAnyCompanyType(types: readonly string[]): boolean {
  return types.some((t) => COMPANY_ORG_TYPES.includes(t as OrgType));
}

export function hasArtistType(types: readonly string[]): boolean {
  return types.includes("artist");
}

/** Rodzaje artysty, dla których ma sens wybór gatunku muzycznego. */
export function artistKindNeedsGenre(kind: ArtistKind | null | undefined): boolean {
  return kind === "band" || kind === "solo";
}
