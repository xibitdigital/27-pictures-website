#!/usr/bin/env node
/**
 * Serve a static folder (default: dist/) on loopback only, with HTTP Basic Auth.
 *
 * For local CDN testing:
 *   VITE_ASSET_BASE=https://pub-….r2.dev npm run build
 *   npm run local:cdn
 *   # or: make local-cdn
 *
 * Env:
 *   PREVIEW_USER   default: dev
 *   PREVIEW_PASS   default: random (printed once; set in .env to pin it)
 *   PREVIEW_HOST   default: 127.0.0.1  (never 0.0.0.0 unless you override)
 *   PREVIEW_PORT   default: 4173
 *
 * Flags:
 *   --dir=dist     static root
 *   --host=…       bind address
 *   --port=N
 *   --user=…
 *   --pass=…
 *   --no-auth      loopback only, no password (still not LAN-exposed by default)
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".map": "application/json",
  ".ico": "image/x-icon",
};

function parseArgs(argv) {
  const opts = {
    dir: path.join(ROOT, "dist"),
    host: process.env.PREVIEW_HOST || "127.0.0.1",
    port: Number(process.env.PREVIEW_PORT || 4173),
    user: process.env.PREVIEW_USER || "dev",
    pass: process.env.PREVIEW_PASS || "",
    auth: true,
  };
  for (const a of argv) {
    if (a.startsWith("--dir=")) opts.dir = path.resolve(a.slice("--dir=".length));
    else if (a.startsWith("--host=")) opts.host = a.slice("--host=".length);
    else if (a.startsWith("--port=")) opts.port = Number(a.slice("--port=".length));
    else if (a.startsWith("--user=")) opts.user = a.slice("--user=".length);
    else if (a.startsWith("--pass=")) opts.pass = a.slice("--pass=".length);
    else if (a === "--no-auth") opts.auth = false;
    else if (a === "-h" || a === "--help") opts.help = true;
  }
  return opts;
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function unauthorized(res, realm = "27 Pictures local preview") {
  send(res, 401, "Authentication required\n", {
    "WWW-Authenticate": `Basic realm="${realm}", charset="UTF-8"`,
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function checkAuth(req, user, pass) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const u = decoded.slice(0, i);
  const p = decoded.slice(i + 1);
  // timing-safe compare
  const ub = Buffer.from(u);
  const pb = Buffer.from(p);
  const eu = Buffer.from(user);
  const ep = Buffer.from(pass);
  if (ub.length !== eu.length || pb.length !== ep.length) return false;
  try {
    return crypto.timingSafeEqual(ub, eu) && crypto.timingSafeEqual(pb, ep);
  } catch {
    return false;
  }
}

function resolveFile(root, urlPath) {
  let full = safeJoin(root, urlPath);
  if (!full) return null;
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    const index = path.join(full, "index.html");
    if (fs.existsSync(index)) return index;
  }
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  // SPA-ish: /toons/jax → /toons/jax/index.html
  if (!path.extname(full)) {
    const withIndex = path.join(full, "index.html");
    if (fs.existsSync(withIndex)) return withIndex;
    const html = full + ".html";
    if (fs.existsSync(html)) return html;
  }
  return null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/serve-protected.js [--dir=dist] [--host=127.0.0.1] [--port=4173]

Serves static files on loopback with HTTP Basic Auth.

  PREVIEW_USER / PREVIEW_PASS   credentials (pass random if unset)
  --no-auth                     skip password (still binds 127.0.0.1 by default)
`);
    process.exit(0);
  }

  if (!fs.existsSync(opts.dir)) {
    console.error(`error: directory not found: ${opts.dir}`);
    console.error("Run a build first: npm run build   or   make local-cdn");
    process.exit(1);
  }

  let generatedPass = false;
  if (opts.auth && !opts.pass) {
    opts.pass = crypto.randomBytes(9).toString("base64url");
    generatedPass = true;
  }

  // Refuse accidental LAN exposure without explicit override
  if (opts.host === "0.0.0.0" || opts.host === "::") {
    console.warn("warning: binding to all interfaces — LAN clients can reach this server.");
  }

  const server = http.createServer((req, res) => {
    // No server fingerprint
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (opts.auth && !checkAuth(req, opts.user, opts.pass)) {
      unauthorized(res);
      return;
    }

    const u = new URL(req.url || "/", `http://${opts.host}`);
    if (u.pathname === "/healthz") {
      send(res, 200, "ok\n", { "Content-Type": "text/plain" });
      return;
    }

    const file = resolveFile(opts.dir, u.pathname);
    if (!file) {
      send(res, 404, "Not found\n", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const body = fs.readFileSync(file);
    send(res, 200, body, {
      "Content-Type": type,
      "Content-Length": body.length,
      // Allow long-cache only for fingerprinted assets under /assets/
      "Cache-Control": u.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-store",
    });
  });

  server.listen(opts.port, opts.host, () => {
    const base = `http://${opts.host}:${opts.port}`;
    console.log("");
    console.log("Protected local preview");
    console.log("──────────────────────");
    console.log(`  dir:   ${path.relative(ROOT, opts.dir) || opts.dir}`);
    console.log(`  bind:  ${opts.host}:${opts.port}  (loopback-only by default)`);
    console.log(`  url:   ${base}/`);
    console.log(`  jax:   ${base}/toons/jax/`);
    console.log(`  erin:  ${base}/toons/erin/`);
    if (opts.auth) {
      console.log(`  user:  ${opts.user}`);
      console.log(`  pass:  ${opts.pass}${generatedPass ? "  (generated — set PREVIEW_PASS in .env to pin)" : ""}`);
      console.log(`  auth:  http://${opts.user}:${opts.pass}@${opts.host}:${opts.port}/`);
    } else {
      console.log("  auth:  off (--no-auth)");
    }
    console.log("");
    console.log("Press Ctrl+C to stop.");
  });
}

main();
