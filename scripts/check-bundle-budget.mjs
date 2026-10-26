#!/usr/bin/env node
/**
 * Frontend bundle-size budget gate.
 *
 * `vite.config.ts` already splits vendors, per-locale translations, and heavy
 * optional deps (mermaid, jspdf, xlsx, katex) into separate chunks, and
 * `rollup-plugin-visualizer` writes `dist/stats.html`. What was missing was a
 * ceiling: a chunk could grow arbitrarily and nothing failed.
 *
 * This script measures the production build and fails when it exceeds the
 * budget, so bundle regressions surface in CI instead of in the field.
 *
 * Usage:
 *   node scripts/check-bundle-budget.mjs [--json]
 *
 * Override the budget for a deliberate change:
 *   BUNDLE_BUDGET_TOTAL_MB=14 BUNDLE_BUDGET_LARGEST_CHUNK_MB=4 pnpm ...
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(rootDir, "apps", "frontend", "dist", "assets");

/**
 * Budgets are deliberately a little above the measured baseline so ordinary
 * code changes do not trip them; they exist to catch real regressions.
 * Baseline (measured post-multi-currency accounting & IAS 21): ~14.6 MB total JS, ~4.17 MB gzip, ~1.4 MB largest chunk (elk).
 */
const TOTAL_JS_BUDGET_MB = Number.parseFloat(process.env.BUNDLE_BUDGET_TOTAL_MB ?? "15.0");
const LARGEST_CHUNK_BUDGET_MB = Number.parseFloat(
  process.env.BUNDLE_BUDGET_LARGEST_CHUNK_MB ?? "2.5",
);
const GZIP_TOTAL_BUDGET_MB = Number.parseFloat(process.env.BUNDLE_BUDGET_GZIP_MB ?? "4.5");

const MB = 1024 * 1024;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  fail(
    `No build output at ${path.relative(rootDir, assetsDir)}. ` +
      "Run `pnpm --filter mms-frontend build` first.",
  );
}

const files = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const full = path.join(assetsDir, name);
    return { name, bytes: fs.statSync(full).size };
  })
  .sort((a, b) => b.bytes - a.bytes);

if (files.length === 0) {
  fail("No JavaScript chunks found in the build output.");
}

const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
const largest = files[0];

// Gzip only the largest chunk: it dominates transfer size and keeps this check
// fast, while still catching "someone imported a heavy dep eagerly".
const gzipTotalBytes = files.reduce(
  (sum, f) => sum + gzipSync(fs.readFileSync(path.join(assetsDir, f.name))).length,
  0,
);

const report = {
  totalJsMb: Number((totalBytes / MB).toFixed(2)),
  gzipTotalJsMb: Number((gzipTotalBytes / MB).toFixed(2)),
  largestChunk: largest.name,
  largestChunkMb: Number((largest.bytes / MB).toFixed(2)),
  chunkCount: files.length,
  budgets: {
    totalJsMb: TOTAL_JS_BUDGET_MB,
    gzipTotalJsMb: GZIP_TOTAL_BUDGET_MB,
    largestChunkMb: LARGEST_CHUNK_BUDGET_MB,
  },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Frontend bundle budget");
  console.log(`  chunks            : ${report.chunkCount}`);
  console.log(`  total JS          : ${report.totalJsMb} MB (budget ${TOTAL_JS_BUDGET_MB} MB)`);
  console.log(
    `  total JS (gzip)   : ${report.gzipTotalJsMb} MB (budget ${GZIP_TOTAL_BUDGET_MB} MB)`,
  );
  console.log(
    `  largest chunk     : ${report.largestChunkMb} MB ${largest.name} ` +
      `(budget ${LARGEST_CHUNK_BUDGET_MB} MB)`,
  );
  console.log("\n  Top 5 chunks:");
  for (const f of files.slice(0, 5)) {
    console.log(`    ${(f.bytes / MB).toFixed(2).padStart(6)} MB  ${f.name}`);
  }
}

const violations = [];
if (totalBytes > TOTAL_JS_BUDGET_MB * MB) {
  violations.push(`total JS ${report.totalJsMb} MB exceeds ${TOTAL_JS_BUDGET_MB} MB`);
}
if (gzipTotalBytes > GZIP_TOTAL_BUDGET_MB * MB) {
  violations.push(`total gzipped JS ${report.gzipTotalJsMb} MB exceeds ${GZIP_TOTAL_BUDGET_MB} MB`);
}
if (largest.bytes > LARGEST_CHUNK_BUDGET_MB * MB) {
  violations.push(
    `largest chunk "${largest.name}" ${report.largestChunkMb} MB exceeds ${LARGEST_CHUNK_BUDGET_MB} MB`,
  );
}

if (violations.length > 0) {
  fail(
    `Bundle budget exceeded:\n  - ${violations.join("\n  - ")}\n\n` +
      "Either reduce the bundle (lazy-load the dependency, review manualChunks in " +
      "apps/frontend/vite.config.ts) or raise the budget deliberately via the " +
      "BUNDLE_BUDGET_* env vars in .github/workflows/ci.yml.",
  );
}

console.log("\n✓ Bundle within budget.");
