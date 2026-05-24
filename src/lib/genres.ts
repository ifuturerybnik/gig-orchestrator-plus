// ============================================================================
// Concertivo — lista gatunków muzycznych dla zespołów (organizations.genres)
// ============================================================================
// Stabilne ID (snake_case) trafiają do DB. Etykiety pochodzą z i18next:
// klucz `organizations.genres.<id>`.

export const MUSIC_GENRES = [
  "pop_rock",
  "metal_punk",
  "indie_alternative",
  "hip_hop_rnb",
  "electronic",
  "jazz_blues",
  "reggae_ska",
  "folk_country",
  "world_latin",
  "classical",
  "cover_wedding",
  "disco_dance",
  "other",
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number];

export function isMusicGenre(value: string): value is MusicGenre {
  return (MUSIC_GENRES as readonly string[]).includes(value);
}
