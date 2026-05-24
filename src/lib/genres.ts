// ============================================================================
// Concertivo — lista gatunków muzycznych dla zespołów (organizations.genres)
// ============================================================================
// Stabilne ID (snake_case) trafiają do DB. Etykiety pochodzą z i18next:
// klucz `organizations.genres.<id>`.

export const MUSIC_GENRES = [
  "pop",
  "rock",
  "pop_rock",
  "rock_alternative",
  "indie",
  "metal",
  "punk",
  "hard_rock",
  "hip_hop",
  "rap",
  "rnb",
  "soul",
  "funk",
  "disco",
  "dance",
  "electronic",
  "house",
  "techno",
  "trance",
  "drum_and_bass",
  "ambient",
  "jazz",
  "blues",
  "reggae",
  "ska",
  "country",
  "folk",
  "world",
  "latin",
  "classical",
  "acoustic",
  "cover",
  "wedding",
  "experimental",
  "other",
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number];

export function isMusicGenre(value: string): value is MusicGenre {
  return (MUSIC_GENRES as readonly string[]).includes(value);
}
