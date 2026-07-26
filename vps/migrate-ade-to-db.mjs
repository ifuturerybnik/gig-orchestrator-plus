#!/usr/bin/env node
// Migracja obecnej env-owej skrzynki e-Doręczeń do tabeli ade_mailboxes.
//
// Wymaga w env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   EXT_PII_ENCRYPTION_KEY (base64, 32B),
//   ADE_CLIENT_ID, ADE_MAILBOX_ADDRESS,
//   ADE_QWAC_CERT_PATH, ADE_QWAC_KEY_PATH,
//   opcjonalnie: ADE_QWAC_KEY_PASSPHRASE, ADE_ENV, ADE_API_BASE, ADE_OAUTH_BASE, ADE_TOKEN_PATH
//
// Uruchomienie na VPS:
//   set -a; . /etc/concertivo.env; set +a
//   node vps/migrate-ade-to-db.mjs
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EXT_PII_ENCRYPTION_KEY",
  "ADE_CLIENT_ID",
  "ADE_MAILBOX_ADDRESS",
  "ADE_QWAC_CERT_PATH",
  "ADE_QWAC_KEY_PATH",
];

function assignEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;

  const separatorIndex = trimmed.includes("=") ? trimmed.indexOf("=") : trimmed.indexOf(":");
  if (separatorIndex <= 0) return;

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) return;
  if (!key.startsWith("ADE_") && !["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EXT_PII_ENCRYPTION_KEY"].includes(key)) return;
  if (process.env[key]) return;

  let value = trimmed.slice(separatorIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

function hydrateEnvFromFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    text.split(/\r?\n/).forEach(assignEnvLine);
  } catch {
    // Plik env może nie istnieć w środowisku lokalnym — wtedy pomijamy.
  }
}

function hydrateEnvFromPm2() {
  try {
    const output = execFileSync("pm2", ["env", process.env.PM2_PROCESS_ID || "0"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    output.split(/\r?\n/).forEach(assignEnvLine);
  } catch {
    // PM2 nie jest wymagany poza VPS-em.
  }
}

function hydrateEnv() {
  hydrateEnvFromFile(process.env.CONCERTIVO_ENV_FILE || "/etc/concertivo.env");
  hydrateEnvFromPm2();
}

function encryptPii(plain) {
  if (!plain) return null;
  const raw = process.env.EXT_PII_ENCRYPTION_KEY;
  if (!raw) throw new Error("Brak EXT_PII_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("EXT_PII_ENCRYPTION_KEY musi mieć 32 bajty po base64-decode");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

async function main() {
  hydrateEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (sprawdź /etc/concertivo.env albo pm2 env 0)");
  const clientId = process.env.ADE_CLIENT_ID;
  const mailboxAddress = process.env.ADE_MAILBOX_ADDRESS;
  const certPath = process.env.ADE_QWAC_CERT_PATH;
  const keyPath = process.env.ADE_QWAC_KEY_PATH;
  if (!clientId || !mailboxAddress || !certPath || !keyPath) {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    throw new Error(`Brakuje zmiennych: ${missing.join(", ")} (skrypt czyta KEY=value z /etc/concertivo.env oraz KEY: value z pm2 env 0)`);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const certPem = readFileSync(certPath, "utf8");
  const keyPem = readFileSync(keyPath, "utf8");
  const passphrase = process.env.ADE_QWAC_KEY_PASSPHRASE || null;

  // Czy już mamy skrzynkę systemową na tym adresie?
  const existing = await supabase
    .from("ade_mailboxes")
    .select("id")
    .eq("owner_kind", "system")
    .eq("mailbox_address", mailboxAddress)
    .maybeSingle();

  const row = {
    owner_kind: "system",
    label: "Skrzynka systemowa (env)",
    mailbox_address: mailboxAddress,
    client_id: clientId,
    ade_env: (process.env.ADE_ENV || "prod").toLowerCase() === "int" ? "int" : "prod",
    api_base: process.env.ADE_API_BASE || null,
    oauth_base: process.env.ADE_OAUTH_BASE || null,
    token_path: process.env.ADE_TOKEN_PATH || null,
    qwac_cert_pem_encrypted: encryptPii(certPem),
    qwac_key_pem_encrypted: encryptPii(keyPem),
    qwac_key_passphrase_encrypted: passphrase ? encryptPii(passphrase) : null,
    is_active: true,
  };

  if (existing.data?.id) {
    const { error } = await supabase.from("ade_mailboxes").update(row).eq("id", existing.data.id);
    if (error) throw error;
    console.log(`Zaktualizowano skrzynkę systemową ${existing.data.id} (${mailboxAddress})`);
  } else {
    const { data, error } = await supabase.from("ade_mailboxes").insert(row).select("id").single();
    if (error) throw error;
    console.log(`Utworzono skrzynkę systemową ${data.id} (${mailboxAddress})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
