#!/usr/bin/env node
/**
 * Minimal static file server for previewing site/ locally. No dependencies.
 * Usage: node scripts/serve.js [port]
 */

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "site");
const PORT = Number(process.argv[2]) || 4321;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);

    // Prevent path traversal outside of ROOT.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let stats;
    try {
      stats = await stat(filePath);
    } catch {
      filePath = path.join(ROOT, "index.html");
      stats = await stat(filePath);
    }
    if (stats.isDirectory()) filePath = path.join(filePath, "index.html");

    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(500).end("Internal server error");
    console.error(err);
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
});
