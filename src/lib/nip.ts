// ============================================================================
// Concertivo — normalizacja i walidacja NIP
// ============================================================================
// Zasada globalna: bez względu na to, jak użytkownik wpisze NIP (spacje,
// myślniki, prefiks kraju), w bazie zapisujemy w formie skondensowanej.
//   "PL 123-456-32-18"  ->  "PL1234563218"
//   "123 456 32 18"     ->  "1234563218"
//
// Walidacja sumy kontrolnej działa dla polskiego NIP (10 cyfr).

export function normalizeNip(raw: string | null | undefined): string {
  if (!raw) return "";
  // zachowaj litery (prefiks kraju), usuń wszystko poza alfanumerycznym
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Wyciąga część cyfrową (do walidacji sumy kontrolnej PL). */
function digitsOnly(nip: string): string {
  return nip.replace(/\D/g, "");
}

/** Walidacja sumy kontrolnej polskiego NIP (10 cyfr). */
export function isValidPolishNip(raw: string): boolean {
  const digits = digitsOnly(normalizeNip(raw));
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * weights[i];
  const check = sum % 11;
  if (check === 10) return false;
  return check === Number(digits[9]);
}

/**
 * Zwraca `true`, jeśli wartość wygląda na poprawny NIP (po normalizacji
 * 10 cyfr i poprawna suma kontrolna — wariant PL) LUB ma prefiks kraju
 * (2 litery) i 8–14 znaków alfanumerycznych (luźna walidacja VAT EU).
 */
export function looksLikeValidNip(raw: string): boolean {
  const norm = normalizeNip(raw);
  if (!norm) return false;
  if (/^[A-Z]{2}/.test(norm)) {
    // VAT EU — luźna walidacja długości
    return norm.length >= 8 && norm.length <= 14;
  }
  return isValidPolishNip(norm);
}
