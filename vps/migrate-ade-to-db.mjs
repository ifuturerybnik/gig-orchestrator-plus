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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const clientId = process.env.ADE_CLIENT_ID;
  const mailboxAddress = process.env.ADE_MAILBOX_ADDRESS;
  const certPath = process.env.ADE_QWAC_CERT_PATH;
  const keyPath = process.env.ADE_QWAC_KEY_PATH;
  if (!clientId || !mailboxAddress || !certPath || !keyPath) {
    throw new Error("Brakuje ADE_CLIENT_ID / ADE_MAILBOX_ADDRESS / ADE_QWAC_CERT_PATH / ADE_QWAC_KEY_PATH");
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
