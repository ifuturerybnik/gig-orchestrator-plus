// SERVER-ONLY. Szyfrowanie haseł SMTP/IMAP w formacie kompatybilnym z mail-proxy
// (AES-256-GCM, layout: iv(12) || ciphertext || tag(16), tag dołączony na końcu —
// tak jak Web Crypto AES-GCM emituje).
// Klucz: MAIL_ENCRYPTION_KEY — hex 64 znaki (32 bajty), wygenerowany przez
// `openssl rand -hex 32`. Musi być DOKŁADNIE ten sam co w .env proxy.
import { createCipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.MAIL_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing MAIL_ENCRYPTION_KEY");
  const cleaned = raw.trim();
  // Wymagamy hex 64 znaki — tak generuje instrukcja w README proxy.
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error(
      "MAIL_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32",
    );
  }
  cachedKey = Buffer.from(cleaned, "hex");
  return cachedKey;
}

/**
 * Szyfruje hasło i zwraca string w formacie `\x<hex>` gotowy do wstawienia
 * jako bytea przez supabase-js (PostgREST akceptuje hex escape).
 */
export function encryptMailPassword(plain: string): string {
  if (!plain) throw new Error("Empty password");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([iv, ct, tag]);
  return "\\x" + out.toString("hex");
}
