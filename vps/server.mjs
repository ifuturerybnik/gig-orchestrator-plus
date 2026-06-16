#!/usr/bin/env node
/**
 * Node.js adapter for the TanStack Start Cloudflare Worker build.
 * Serves static files from dist/client and forwards everything else to the SSR worker.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;
const CLIENT_DIR = resolve(__dirname, "../dist/client");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const entries = {};
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    entries[key] = rawValue.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return entries;
}

function applyEnv(entries, options = {}) {
  for (const [key, value] of Object.entries(entries)) {
    if (!value) continue;
    if (options.only && !options.only.includes(key)) continue;
    if (!process.env[key]) process.env[key] = value;
  }
}

function readPm2ModuleConfig(appNames) {
  const paths = [
    process.env.PM2_HOME ? resolve(process.env.PM2_HOME, "module_conf.json") : "",
    process.env.HOME ? resolve(process.env.HOME, ".pm2/module_conf.json") : "",
    "/root/.pm2/module_conf.json",
  ].filter(Boolean);

  for (const filePath of [...new Set(paths)]) {
    if (!existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      for (const appName of appNames) {
        const config = parsed?.[appName] || parsed?.module_conf?.[appName];
        if (config && typeof config === "object") return config;
      }
    } catch {
      // Ignore invalid PM2 config and keep using normal environment sources.
    }
  }
  return {};
}

applyEnv(parseEnvFile("/etc/concertivo.env"));
applyEnv(parseEnvFile(resolve(__dirname, "../.env.production")));
applyEnv(parseEnvFile(resolve(__dirname, "../.env")));
applyEnv(readPm2ModuleConfig(["concertivo", process.env.name, process.env.pm2_name].filter(Boolean)));

const proxyEnv = {
  ...parseEnvFile("/opt/mail-proxy-concertivo/.env"),
  ...parseEnvFile(resolve(__dirname, "mail-proxy-concertivo/.env")),
};
applyEnv(proxyEnv, { only: ["MAIL_ENCRYPTION_KEY"] });
if (!process.env.MAIL_PROXY_TOKEN && proxyEnv.PROXY_TOKEN) {
  process.env.MAIL_PROXY_TOKEN = proxyEnv.PROXY_TOKEN;
}
if (!process.env.EXT_MAIL_ENCRYPTION_KEY && process.env.MAIL_ENCRYPTION_KEY) {
  process.env.EXT_MAIL_ENCRYPTION_KEY = process.env.MAIL_ENCRYPTION_KEY;
}
if (!process.env.MAIL_ENCRYPTION_KEY && process.env.EXT_MAIL_ENCRYPTION_KEY) {
  process.env.MAIL_ENCRYPTION_KEY = process.env.EXT_MAIL_ENCRYPTION_KEY;
}

// MIME types for static assets
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".webp": "image/webp",
};

// Import the worker server entry (ESM)
const workerPath = resolve(__dirname, "../dist/server/server.js");
const workerMod = await import(workerPath);
const worker = workerMod.default || workerMod;

/** Read request body into a Buffer */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Serve a static file if it exists */
async function serveStatic(reqPath) {
  const safePath = reqPath.replace(/\.{2,}/g, "").replace(/^\//, "");
  const filePath = resolve(CLIENT_DIR, safePath || "index.html");
  if (!filePath.startsWith(CLIENT_DIR)) return null;
  if (!existsSync(filePath)) return null;
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const content = await readFile(filePath);
  return new Response(content, { headers: { "content-type": mime } });
}

const nodeServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // 1. Try static files first (assets with hash, plus root-level files like favicon.png, robots.txt)
    const isHashedAsset =
      pathname.startsWith("/assets/") || pathname.startsWith("/email-icons/");
    const isRootStaticFile =
      pathname !== "/" && /^\/[^/]+\.[a-zA-Z0-9]+$/.test(pathname);
    if (isHashedAsset || isRootStaticFile) {
      const staticRes = await serveStatic(pathname);
      if (staticRes) {
        res.statusCode = staticRes.status;
        staticRes.headers.forEach((v, k) => res.setHeader(k, v));
        const buf = Buffer.from(await staticRes.arrayBuffer());
        res.end(buf);
        return;
      }
    }

    // 2. Convert Node request to Web Request
    const bodyBuf = await readBody(req);
    const request = new Request(url, {
      method: req.method,
      headers: new Headers(
        Object.entries(req.headers)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)])
      ),
      body: req.method !== "GET" && req.method !== "HEAD" && bodyBuf.length > 0 ? bodyBuf : undefined,
    });

    // 3. Call the Worker handler
    const env = process.env;
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, env, ctx);

    // 4. Convert Web Response back to Node response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key === "set-cookie") {
        // Handle multiple Set-Cookie headers
        res.setHeader(key, value);
      } else {
        res.setHeader(key, value);
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end("Internal Server Error");
    }
  }
});

nodeServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Concertivo VPS server running on http://0.0.0.0:${PORT}`);
});
