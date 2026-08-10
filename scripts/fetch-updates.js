#!/usr/bin/env node
/**
 * Fetches the latest entries from Microsoft's public Azure Updates API,
 * turns each raw entry into a clean { summary, keyPoints, ... } record,
 * and merges the result into site/data/updates.json.
 *
 * Zero external dependencies — only Node's built-in fetch/fs (Node >= 18).
 *
 * Usage:
 *   node scripts/fetch-updates.js              # incremental (recent pages only)
 *   node scripts/fetch-updates.js --backfill   # deep pull, for first run / history
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "site", "data");
const DATA_FILE = path.join(DATA_DIR, "updates.json");
const META_FILE = path.join(DATA_DIR, "meta.json");

const API_BASE = "https://www.microsoft.com/releasecommunications/api/v2/azure";
const PAGE_SIZE = 100;

const isBackfill = process.argv.includes("--backfill") || !existsSync(DATA_FILE);
// Incremental runs only need to look a little past one page deep to safely
// catch anything posted or edited since the last run; backfill pulls history.
const MAX_PAGES = isBackfill ? 20 : 3;

// ---------- tiny HTML helpers (no dependency needed for this feed's markup) ----------

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|ndash|mdash|hellip);/g, (_, name) => NAMED_ENTITIES[name] ?? "");
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractLearnMoreUrl(html) {
  const match = String(html || "").match(/<a\s+[^>]*href="([^"]+)"[^>]*>/i);
  return match ? match[1] : null;
}

function extractKeyPoints(html, fallbackSentences) {
  const items = [...String(html || "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  if (items.length) return items.slice(0, 6);
  // No bullet list in the source — use the remaining sentences as points.
  return fallbackSentences.slice(1, 5);
}

function buildSummary(sentences) {
  if (!sentences.length) return "";
  let summary = sentences[0];
  if (summary.length < 60 && sentences[1]) summary += " " + sentences[1];
  if (summary.length > 320) {
    summary = summary.slice(0, 317).replace(/\s+\S*$/, "") + "…";
  }
  return summary;
}

// ---------- status normalization ----------

const STATUS_META = {
  Launched: { label: "Generally Available", className: "ga" },
  "General Availability": { label: "Generally Available", className: "ga" },
  "In preview": { label: "Public Preview", className: "preview" },
  Preview: { label: "Public Preview", className: "preview" },
  "In development": { label: "In Development", className: "dev" },
  Retired: { label: "Retirement", className: "retired" },
  Retirement: { label: "Retirement", className: "retired" },
  "Retirement notice": { label: "Retirement", className: "retired" },
};

function statusMeta(status) {
  return STATUS_META[status] || { label: status || "Update", className: "other" };
}

// ---------- fetching ----------

async function fetchPage(skip) {
  const params = [
    ["$orderby", "modified desc"],
    ["$top", String(PAGE_SIZE)],
    ["$skip", String(skip)],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${API_BASE}?${params}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Azure updates API request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return Array.isArray(json.value) ? json.value : [];
}

function transform(raw) {
  const html = raw.description || "";
  const text = stripTags(html);
  const sentences = splitSentences(text);
  const meta = statusMeta(raw.status);

  return {
    id: String(raw.id),
    title: decodeEntities(String(raw.title || "")).trim(),
    url: `https://azure.microsoft.com/en-us/updates?id=${encodeURIComponent(raw.id)}`,
    learnMoreUrl: extractLearnMoreUrl(html),
    status: raw.status || null,
    statusLabel: meta.label,
    statusClass: meta.className,
    categories: raw.productCategories || [],
    products: raw.products || [],
    tags: raw.tags || [],
    summary: buildSummary(sentences) || text.slice(0, 280),
    keyPoints: extractKeyPoints(html, sentences),
    created: raw.created || raw.modified || null,
    modified: raw.modified || raw.created || null,
    availabilities: raw.availabilities || [],
  };
}

// ---------- persistence ----------

async function loadExisting() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const existing = await loadExisting();
  const byId = new Map(existing.map((e) => [e.id, e]));

  let added = 0;
  let updated = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchPage(page * PAGE_SIZE);
    if (!batch.length) break;

    for (const raw of batch) {
      if (raw?.id == null) continue;
      const item = transform(raw);
      const prev = byId.get(item.id);
      if (!prev) {
        added++;
        byId.set(item.id, item);
      } else if (prev.modified !== item.modified) {
        updated++;
        byId.set(item.id, item);
      }
    }

    if (batch.length < PAGE_SIZE) break;
  }

  const all = [...byId.values()].sort((a, b) => new Date(b.created) - new Date(a.created));

  await writeFile(DATA_FILE, JSON.stringify(all, null, 2));
  await writeFile(
    META_FILE,
    JSON.stringify(
      {
        lastRun: new Date().toISOString(),
        totalCount: all.length,
        added,
        updated,
        mode: isBackfill ? "backfill" : "incremental",
      },
      null,
      2
    )
  );

  console.log(
    `Azure changelog data updated. total=${all.length} added=${added} updated=${updated} mode=${isBackfill ? "backfill" : "incremental"}`
  );
}

main().catch((err) => {
  console.error("Failed to update Azure changelog data:", err);
  process.exit(1);
});
