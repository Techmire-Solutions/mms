#!/usr/bin/env node
/**
 * Keep the Turbo cache bounded before GitHub Actions archives it.
 *
 * Why: the workflow cache key is per-commit and the archive is written every
 * run. Restoring the previous snapshot and saving the union made each entry
 * grow — the `build` cache reached ~1.6 GB per commit (five entries = 8.0 GB of
 * the repository's 10 GB cache budget), evicting the pnpm and Playwright caches.
 * Pruning right after restore keeps every saved entry small while preserving the
 * newest task artifacts, so turbo still gets cache hits without the churn.
 *
 * Turbo stores one entry per task hash as `<hash>.tar.zst` plus `<hash>-meta.json`
 * and `<hash>-manifest.json`; an entry is only useful as a complete triplet.
 *
 * Usage: node scripts/ci/prune-turbo-cache.mjs [--dir <path>]... [--max-mb 350]
 *        [--max-age-days 14] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_RE = /^(?<hash>[0-9a-f]+)(?:\.tar\.zst|-meta\.json|-manifest\.json)$/;

/**
 * @typedef {{ name: string, bytes: number, mtimeMs: number }} CacheFile
 * @typedef {{ hash: string, bytes: number, mtimeMs: number, names: string[] }} CacheEntry
 */

/**
 * Collapse individual cache files into per-hash entries.
 *
 * @param {CacheFile[]} files
 * @returns {CacheEntry[]}
 */
export function groupCacheEntries(files) {
  /** @type {Map<string, CacheEntry>} */
  const byHash = new Map();
  for (const file of files) {
    const match = ENTRY_RE.exec(file.name);
    if (!match?.groups?.hash) continue;
    const hash = match.groups.hash;
    const entry = byHash.get(hash) ?? { hash, bytes: 0, mtimeMs: 0, names: [] };
    entry.bytes += file.bytes;
    entry.mtimeMs = Math.max(entry.mtimeMs, file.mtimeMs);
    entry.names.push(file.name);
    byHash.set(hash, entry);
  }
  return [...byHash.values()];
}

/**
 * Choose which entries survive: newest first, bounded by bytes and age.
 * The newest entry is always kept so a single oversized build output cannot
 * empty the cache; every other entry must fit the remaining budget.
 *
 * @param {CacheEntry[]} entries
 * @param {{ maxBytes: number, nowMs: number, maxAgeMs: number }} options
 * @returns {{ keep: string[], delete: string[], keptBytes: number }}
 */
export function selectPrunable(entries, { maxBytes, nowMs, maxAgeMs }) {
  const sorted = [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs || a.hash.localeCompare(b.hash));
  /** @type {string[]} */
  const keep = [];
  /** @type {string[]} */
  const remove = [];
  let keptBytes = 0;

  for (const entry of sorted) {
    const tooOld = nowMs - entry.mtimeMs > maxAgeMs;
    if (tooOld) {
      remove.push(entry.hash);
      continue;
    }
    const first = keep.length === 0;
    if (!first && keptBytes + entry.bytes > maxBytes) {
      remove.push(entry.hash);
      continue;
    }
    keep.push(entry.hash);
    keptBytes += entry.bytes;
  }

  return { keep, delete: remove, keptBytes };
}

function parseArgs(argv) {
  const options = {
    dirs: [],
    maxMb: 350,
    maxAgeDays: 14,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") options.dirs.push(argv[++i] ?? "");
    else if (arg === "--max-mb") options.maxMb = Number(argv[++i]);
    else if (arg === "--max-age-days") options.maxAgeDays = Number(argv[++i]);
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") return { help: true, ...options };
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.dirs.length === 0) options.dirs.push(".turbo/cache");
  if (!Number.isFinite(options.maxMb) || options.maxMb <= 0) {
    throw new Error("--max-mb must be a positive number");
  }
  if (!Number.isFinite(options.maxAgeDays) || options.maxAgeDays < 0) {
    throw new Error("--max-age-days must be zero or a positive number");
  }
  return options;
}

function pruneDir(dir, options, nowMs) {
  /** @type {CacheFile[]} */
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    files.push({ name, bytes: stat.size, mtimeMs: stat.mtimeMs });
  }

  const entries = groupCacheEntries(files);
  if (entries.length === 0) {
    console.log(`prune-turbo-cache: ${dir} has no cache entries`);
    return;
  }

  const { delete: remove, keptBytes } = selectPrunable(entries, {
    maxBytes: options.maxMb * MB,
    nowMs,
    maxAgeMs: options.maxAgeDays * DAY_MS,
  });
  const byHash = new Map(entries.map((entry) => [entry.hash, entry]));

  let removedBytes = 0;
  let removedFiles = 0;
  for (const hash of remove) {
    const entry = byHash.get(hash);
    if (!entry) continue;
    for (const name of entry.names) {
      if (!options.dryRun) {
        try {
          fs.unlinkSync(path.join(dir, name));
        } catch {
          continue;
        }
      }
      removedFiles += 1;
      removedBytes += entry.bytes / entry.names.length;
    }
  }

  const kept = entries.length - remove.length;
  console.log(
    `prune-turbo-cache: ${dir} keep ${kept} entries (${(keptBytes / MB).toFixed(0)} MB), ` +
      `remove ${remove.length} entries (${(removedBytes / MB).toFixed(0)} MB, ${removedFiles} files)` +
      `${options.dryRun ? " [dry-run]" : ""}`,
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`prune-turbo-cache: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(
      "usage: prune-turbo-cache.mjs [--dir <path>]... [--max-mb n] [--max-age-days n] [--dry-run]",
    );
    return;
  }

  const nowMs = Date.now();
  let pruned = false;
  for (const dir of options.dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    pruneDir(dir, options, nowMs);
    pruned = true;
  }
  if (!pruned) console.log("prune-turbo-cache: no cache directories, nothing to do");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
