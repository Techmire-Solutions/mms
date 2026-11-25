#!/usr/bin/env node
/**
 * PWA precache budget gate.
 *
 * `scripts/check-bundle-budget.mjs` measures the JavaScript in `dist/assets` and
 * knows nothing about `dist/sw.js`. That gap let the service worker precache
 * every emitted chunk — 647 entries / ~16 MB raw, including mermaid's `elk`
 * (1.4 MB), `cytoscape`, `xlsx`, `jspdf`, all four locale packs and a 1.2 MB
 * unused logo — on the first visit of every user.
 *
 * This gate pins the precache to the app shell + entry closure (see
 * `apps/tenant-web/src/lib/pwa/entryClosurePrecache.ts`) and fails if heavy or
 * unused chunks creep back in.
 *
 * Budgets are split by population, because they answer different questions:
 *   - `globEntries`    — the shell assets matched by Workbox `globPatterns`.
 *   - `closureEntries` — transform additions (leading `/`): the entry's static
 *                        import closure.
 *   - `lazyChunks`     — chunks in the build manifest that are NOT in the closure.
 *                        A floor here is what catches a lazy-loading regression
 *                        (a route/optional chunk pulled into the shell) even when
 *                        the closure still fits its ceiling.
 *
 * Baseline (2026-11-25, `apps/tenant-web` fresh build, after P8b):
 *   glob 7 · closure 72 · payload 2.25 MB · 600 chunks with 529 lazy.
 *   Ceilings keep ~10-15 % headroom: glob 10 · closure 80 · payload 2.5 MB ·
 *   lazy floor 450. Re-record every number here whenever a ceiling moves.
 *
 *   P8b context: mounting the module host bridges in `providers/AppProviders.tsx`
 *   put `_moduleReports` (309K, 142 static imports) in the entry closure, which
 *   dragged 240 chunks / 3.36 MB — including the FORBIDDEN `vendor-motion` and
 *   `vendor-charts` — into the precache (closure 270 / 3.93 MB). They now live in
 *   `providers/TenantScopedProviders.tsx`, inside the lazy `TenantRoutes` chunk, so
 *   the lazy floor deliberately sits above the relapse level: re-eager-mounting the
 *   bridges would drop `lazy` toward ~330 and fail this gate.
 *
 * Usage:
 *   node scripts/check-pwa-precache.mjs [--json]
 *
 * Override for a deliberate change:
 *   PWA_PRECACHE_MAX_GLOB_ENTRIES=12 PWA_PRECACHE_MAX_CLOSURE_ENTRIES=100 \
 *   PWA_PRECACHE_MAX_MB=3 PWA_PRECACHE_MIN_LAZY_CHUNKS=400 \
 *     node scripts/check-pwa-precache.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MB = 1024 * 1024;

/** Default ceilings; every one is env-overridable for a deliberate audit. */
export const DEFAULT_BUDGETS = Object.freeze({
  maxGlobEntries: 10,
  maxClosureEntries: 80,
  maxMb: 2.5,
  minLazyChunks: 450,
});

/** Optional/large chunks that must stay lazy (runtime-cached on first use). */
const FORBIDDEN = [
  { pattern: /(?:^|\/)elk-[\w-]+\.js$/, label: "mermaid elk diagram engine" },
  { pattern: /(?:^|\/)cytoscape[\w.-]*\.js$/, label: "mermaid cytoscape dependency" },
  { pattern: /(?:^|\/)xlsx-[\w-]+\.js$/, label: "xlsx export library" },
  { pattern: /(?:^|\/)jspdf[\w.-]*\.js$/, label: "jspdf export library" },
  { pattern: /(?:^|\/)html2canvas-[\w-]+\.js$/, label: "html2canvas capture library" },
  { pattern: /(?:^|\/)katex-[\w-]+\.js$/, label: "katex math renderer" },
  {
    pattern: /(?:^|\/)vendor-motion-[\w-]+\.js$/,
    label: "framer-motion runtime (loads with the authenticated shell, not first paint)",
  },
  { pattern: /(?:^|\/)mms-i18n-(?:ar|ur|fa)-[\w-]+\.js$/, label: "non-default locale pack" },
  { pattern: /(?:^|\/)platform-logo\.png$/, label: "unused platform logo raster" },
];

/** The shell must be bootable offline: entry JS + entry CSS stay in precache. */
const REQUIRED = [
  // Glob results carry no leading slash; transform additions do.
  { pattern: /^\/?index\.html$/, label: "app shell HTML" },
  { pattern: /^\/assets\/index-[\w-]+\.js$/, label: "entry chunk" },
  { pattern: /^\/assets\/index-[\w-]+\.css$/, label: "entry stylesheet" },
];

/** Read a non-negative integer from `env`, falling back to the default. */
function envInt(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Read a positive number from `env`, falling back to the default. */
function envFloat(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function budgetsFromEnv(env = process.env) {
  return {
    maxGlobEntries: envInt(env, "PWA_PRECACHE_MAX_GLOB_ENTRIES", DEFAULT_BUDGETS.maxGlobEntries),
    maxClosureEntries: envInt(
      env,
      "PWA_PRECACHE_MAX_CLOSURE_ENTRIES",
      DEFAULT_BUDGETS.maxClosureEntries,
    ),
    maxMb: envFloat(env, "PWA_PRECACHE_MAX_MB", DEFAULT_BUDGETS.maxMb),
    minLazyChunks: envInt(env, "PWA_PRECACHE_MIN_LAZY_CHUNKS", DEFAULT_BUDGETS.minLazyChunks),
  };
}

/**
 * Workbox records glob matches without a leading slash and every
 * `manifestTransforms` addition with one, so the slash is the population marker.
 */
export function classifyPrecacheEntries(entries) {
  const globEntries = [];
  const closureEntries = [];
  for (const entry of entries) {
    if (entry.startsWith("/")) closureEntries.push(entry);
    else globEntries.push(entry);
  }
  return { globEntries, closureEntries };
}

/**
 * Counts chunks reachable from the manifest entry through **static** imports
 * (dynamic imports stay lazy). Returns `null` when the manifest has no entry,
 * which the caller treats as fail-closed.
 */
export function countLazyChunks(manifest) {
  if (!manifest || typeof manifest !== "object") return null;
  const keys = Object.keys(manifest);
  const entryKey = keys.find((key) => manifest[key]?.isEntry);
  if (!entryKey) return null;

  const seen = new Set();
  const stack = [entryKey];
  while (stack.length > 0) {
    const key = stack.pop();
    if (key === undefined || seen.has(key)) continue;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    for (const dependency of chunk.imports ?? []) stack.push(dependency);
  }

  return { total: keys.length, closure: seen.size, lazy: keys.length - seen.size };
}

/** Budget violations for a measured precache; an empty array is a pass. */
export function evaluateBudgets(measured, budgets) {
  const violations = [];
  if (measured.globEntries > budgets.maxGlobEntries) {
    violations.push(
      `shell glob precaches ${measured.globEntries} entries (budget ${budgets.maxGlobEntries})`,
    );
  }
  if (measured.closureEntries > budgets.maxClosureEntries) {
    violations.push(
      `entry closure precaches ${measured.closureEntries} entries (budget ${budgets.maxClosureEntries})`,
    );
  }
  if (measured.totalMb > budgets.maxMb) {
    violations.push(`precache payload ${measured.totalMb} MB exceeds ${budgets.maxMb} MB`);
  }
  if (!measured.lazy) {
    violations.push(
      "build manifest has no entry — cannot prove lazy-loading is intact " +
        "(run `pnpm --filter mms-tenant-web build` with `build.manifest: true`)",
    );
  } else if (measured.lazy.lazy < budgets.minLazyChunks) {
    violations.push(
      `only ${measured.lazy.lazy} lazy chunks remain (floor ${budgets.minLazyChunks}) — ` +
        "a route or optional chunk was pulled into the entry closure",
    );
  }
  return violations;
}

/** Parses the Workbox precache manifest out of a built `sw.js`. */
export function parsePrecacheEntries(swSource) {
  return [...swSource.matchAll(/url:"([^"]+)",revision:(?:null|"[^"]*")/g)].map(
    (match) => match[1],
  );
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  return 1;
}

/** Repository root from this file's location (independent of `process.cwd()`). */
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function main({ argv = process.argv, rootDir = ROOT_DIR } = {}) {
  const distDir = path.join(rootDir, "apps", "tenant-web", "dist");
  const swPath = path.join(distDir, "sw.js");
  const manifestPath = path.join(distDir, ".vite", "manifest.json");

  if (!fs.existsSync(swPath)) {
    return fail(
      `No service worker at ${path.relative(rootDir, swPath)}. ` +
        "Run `pnpm --filter mms-tenant-web build` first.",
    );
  }

  const entries = parsePrecacheEntries(fs.readFileSync(swPath, "utf8"));
  if (entries.length === 0) {
    return fail(
      "Could not parse a precache manifest from dist/sw.js (Workbox output shape changed?).",
    );
  }

  let lazy = null;
  if (fs.existsSync(manifestPath)) {
    try {
      lazy = countLazyChunks(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
    } catch {
      lazy = null;
    }
  }

  const measuredEntries = [];
  let totalBytes = 0;
  for (const url of entries) {
    const filePath = path.join(distDir, url.replace(/^\//, ""));
    const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    totalBytes += size;
    measuredEntries.push({ url, size });
  }

  const { globEntries, closureEntries } = classifyPrecacheEntries(entries);
  const totalMb = Number((totalBytes / MB).toFixed(2));
  const budgets = budgetsFromEnv();

  const forbidden = measuredEntries.filter((entry) =>
    FORBIDDEN.some((rule) => rule.pattern.test(entry.url)),
  );
  const missingRequired = REQUIRED.filter(
    (rule) => !measuredEntries.some((entry) => rule.pattern.test(entry.url)),
  );

  const report = {
    globEntries: globEntries.length,
    closureEntries: closureEntries.length,
    entries: measuredEntries.length,
    totalMb,
    lazyChunks: lazy,
    swMb: Number((fs.statSync(swPath).size / MB).toFixed(2)),
    forbidden: forbidden.map((entry) => entry.url),
    missingRequired: missingRequired.map((rule) => rule.label),
    largest: measuredEntries
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 8)
      .map((entry) => `${(entry.size / 1024).toFixed(0)}K ${entry.url}`),
    budgets,
  };

  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("PWA precache budget");
    console.log(`  shell glob        : ${report.globEntries} (budget ${budgets.maxGlobEntries})`);
    console.log(
      `  entry closure     : ${report.closureEntries} (budget ${budgets.maxClosureEntries})`,
    );
    console.log(`  total entries     : ${report.entries}`);
    console.log(`  precached payload : ${report.totalMb} MB (budget ${budgets.maxMb} MB)`);
    console.log(
      `  lazy chunks       : ${lazy ? lazy.lazy : "unknown"} / ${lazy ? lazy.total : "?"} ` +
        `(floor ${budgets.minLazyChunks})`,
    );
    console.log(`  service worker    : ${report.swMb} MB`);
    console.log("\n  Largest entries:");
    for (const line of report.largest) console.log(`    ${line}`);
  }

  const violations = evaluateBudgets(
    {
      globEntries: globEntries.length,
      closureEntries: closureEntries.length,
      totalMb,
      lazy,
    },
    budgets,
  );
  for (const entry of forbidden) {
    const rule = FORBIDDEN.find((candidate) => candidate.pattern.test(entry.url));
    violations.push(`optional chunk precached: ${entry.url} (${rule?.label})`);
  }
  for (const rule of missingRequired) {
    violations.push(`required shell asset missing from precache: ${rule.label}`);
  }

  if (violations.length > 0) {
    return fail(`PWA precache budget exceeded:\n  - ${violations.join("\n  - ")}`);
  }

  console.log("\n✓ PWA precache within budget.");
  return 0;
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("check-pwa-precache.mjs") ||
    fileURLToPath(import.meta.url) === process.argv[1]);

if (isEntrypoint) {
  process.exitCode = main();
}
