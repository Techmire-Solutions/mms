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
 * `apps/frontend/src/lib/pwa/entryClosurePrecache.ts`) and fails if heavy or
 * unused chunks creep back in.
 *
 * Usage:
 *   node scripts/check-pwa-precache.mjs [--json]
 *
 * Override for a deliberate change:
 *   PWA_PRECACHE_MAX_ENTRIES=60 PWA_PRECACHE_MAX_MB=3.5 node scripts/check-pwa-precache.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "apps", "frontend", "dist");
const swPath = path.join(distDir, "sw.js");

/** Measured with the entry-closure transform: 38 entries / ~2.3 MB raw. */
const MAX_ENTRIES = Number.parseInt(process.env.PWA_PRECACHE_MAX_ENTRIES ?? "50", 10);
const MAX_MB = Number.parseFloat(process.env.PWA_PRECACHE_MAX_MB ?? "3.5");

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

const MB = 1024 * 1024;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(swPath)) {
  fail(
    `No service worker at ${path.relative(rootDir, swPath)}. ` +
      "Run `pnpm --filter mms-frontend build` first.",
  );
}

const swSource = fs.readFileSync(swPath, "utf8");
const entries = [...swSource.matchAll(/url:"([^"]+)",revision:(?:null|"[^"]*")/g)].map(
  (match) => match[1],
);

if (entries.length === 0) {
  fail("Could not parse a precache manifest from dist/sw.js (Workbox output shape changed?).");
}

const measured = [];
let totalBytes = 0;
for (const url of entries) {
  const filePath = path.join(distDir, url.replace(/^\//, ""));
  const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  totalBytes += size;
  measured.push({ url, size });
}

const totalMb = Number((totalBytes / MB).toFixed(2));
const forbidden = measured.filter((entry) =>
  FORBIDDEN.some((rule) => rule.pattern.test(entry.url)),
);
const missingRequired = REQUIRED.filter(
  (rule) => !measured.some((entry) => rule.pattern.test(entry.url)),
);

const report = {
  entries: measured.length,
  totalMb,
  swMb: Number((fs.statSync(swPath).size / MB).toFixed(2)),
  forbidden: forbidden.map((entry) => entry.url),
  missingRequired: missingRequired.map((rule) => rule.label),
  largest: measured
    .slice()
    .sort((a, b) => b.size - a.size)
    .slice(0, 8)
    .map((entry) => `${(entry.size / 1024).toFixed(0)}K ${entry.url}`),
  budgets: { entries: MAX_ENTRIES, totalMb: MAX_MB },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("PWA precache budget");
  console.log(`  entries           : ${report.entries} (budget ${MAX_ENTRIES})`);
  console.log(`  precached payload : ${report.totalMb} MB (budget ${MAX_MB} MB)`);
  console.log(`  service worker    : ${report.swMb} MB`);
  console.log("\n  Largest entries:");
  for (const line of report.largest) console.log(`    ${line}`);
}

const violations = [];
if (measured.length > MAX_ENTRIES) {
  violations.push(`precache has ${measured.length} entries (budget ${MAX_ENTRIES})`);
}
if (totalBytes > MAX_MB * MB) {
  violations.push(`precache payload ${totalMb} MB exceeds ${MAX_MB} MB`);
}
for (const entry of forbidden) {
  const rule = FORBIDDEN.find((candidate) => candidate.pattern.test(entry.url));
  violations.push(`optional chunk precached: ${entry.url} (${rule?.label})`);
}
for (const rule of missingRequired) {
  violations.push(`required shell asset missing from precache: ${rule.label}`);
}

if (violations.length > 0) {
  fail(`PWA precache budget exceeded:\n  - ${violations.join("\n  - ")}`);
}

console.log("\n✓ PWA precache within budget.");
