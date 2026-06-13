// SERVER-ONLY. Szyfrowanie haseł SMTP/IMAP w formacie kompatybilnym z mail-proxy
// (AES-256-GCM, layout: iv(12) || ciphertext || tag(16), tag dołączony na końcu —
// tak jak Web Crypto AES-GCM emituje).
// Klucz: MAIL_ENCRYPTION_KEY — hex 64 znaki (32 bajty), wygenerowany przez
// `openssl rand -hex 32`. Musi być DOKŁADNIE ten sam co w .env proxy.
import { createCipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function normalizeMailEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "Brak klucza szyfrowania poczty. Ustaw sekret MAIL_ENCRYPTION_KEY z tą samą wartością, która jest używana w mail-proxy.",
    );
  }
  const cleaned = raw
    .trim()
    .replace(/^\s*(?:MAIL_ENCRYPTION_KEY|EXT_MAIL_ENCRYPTION_KEY)\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  // Wymagamy hex 64 znaki — tak generuje instrukcja w README proxy.
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error(
      "MAIL_ENCRYPTION_KEY musi mieć 64 znaki hex (32 bajty). Wygeneruj: openssl rand -hex 32 i użyj tej samej wartości w aplikacji oraz mail-proxy.",
    );
  }
  return Buffer.from(cleaned, "hex");
}

/**
 * Szyfruje hasło i zwraca string w formacie `\x<hex>` gotowy do wstawienia
 * jako bytea przez supabase-js (PostgREST akceptuje hex escape).
 */
export function encryptMailPassword(plain: string): string {
  return encryptMailPasswordWithKey(
    plain,
    process.env.MAIL_ENCRYPTION_KEY ?? process.env.EXT_MAIL_ENCRYPTION_KEY,
  );
}

export function encryptMailPasswordWithKey(plain: string, rawKey: string | undefined): string {
  if (!plain) throw new Error("Empty password");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, normalizeMailEncryptionKey(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([iv, ct, tag]);
  return "\\x" + out.toString("hex");
}
