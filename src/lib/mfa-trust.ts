// Helpers for "remember this device 30 days" — skip MFA prompt on trusted browser.
const PREFIX = "concertivo.mfa_trust.";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

export function trustDevice(userId: string) {
  try {
    localStorage.setItem(PREFIX + userId, String(Date.now() + DAYS_30));
  } catch {
    /* ignore */
  }
}

export function isDeviceTrusted(userId: string): boolean {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return false;
    const expiry = Number(raw);
    if (!Number.isFinite(expiry) || Date.now() > expiry) {
      localStorage.removeItem(PREFIX + userId);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearTrust(userId: string) {
  try {
    localStorage.removeItem(PREFIX + userId);
  } catch {
    /* ignore */
  }
}
