#!/usr/bin/env node
/**
 * Builds the Lighthouse CI PR comment from the raw LHR files written by
 * `@lhci/cli autorun` (`.lighthouseci/lhr-*.json`).
 *
 * LHCI 0.14 does not write `.lighthouseci/manifest.json`, so the previous
 * inline `node -e` summariser always reported "No LHCI manifest found" and the
 * PR comment was never posted. Reading the LHR files directly also lets this
 * run locally with `node scripts/perf/format-lhci-comment.cjs`.
 *
 * Usage: node scripts/perf/format-lhci-comment.cjs [resultsDir] [outputFile]
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const resultsDir = path.resolve(process.argv[2] ?? ".lighthouseci");
const outputFile = path.resolve(process.argv[3] ?? "lhci-comment.md");

const BUDGETS = {
  performance: 55,
  lcp: 7200,
  tbt: 300,
  scriptKiB: 600,
};

/** @returns {Array<Record<string, unknown>>} */
function readRuns(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => /^lhr-.*\.json$/.test(file))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.fetchTime ?? "").localeCompare(String(b.fetchTime ?? "")));
}

function score(run, category) {
  const value = run.categories?.[category]?.score;
  return typeof value === "number" ? Math.round(value * 100) : 0;
}

function numeric(run, auditId) {
  const value = run.audits?.[auditId]?.numericValue;
  return typeof value === "number" ? value : 0;
}

function scriptBytes(run) {
  const items = run.audits?.["resource-summary"]?.details?.items ?? [];
  const script = items.find((item) => item.resourceType === "script");
  return typeof script?.transferSize === "number" ? script.transferSize : 0;
}

function verdict(passed) {
  return passed ? "✅" : "❌";
}

function main() {
  const runs = readRuns(resultsDir);
  if (runs.length === 0) {
    console.log(`No Lighthouse runs found in ${resultsDir}; skipping PR comment.`);
    return;
  }

  const rows = runs.map((run, index) => {
    const perf = score(run, "performance");
    const lcp = numeric(run, "largest-contentful-paint");
    const tbt = numeric(run, "total-blocking-time");
    return {
      run: index + 1,
      url: run.finalDisplayedUrl ?? run.finalUrl ?? run.requestedUrl ?? "unknown",
      accessibility: score(run, "accessibility"),
      bestPractices: score(run, "best-practices"),
      seo: score(run, "seo"),
      perf,
      lcp,
      tbt,
      scriptKiB: Math.round((scriptBytes(run) / 1024) * 10) / 10,
    };
  });

  const lines = [
    "### ⚡ Lighthouse CI Performance Summary",
    "",
    "| Run | URL | Performance | Accessibility | Best Practices | SEO | LCP | TBT | Initial scripts |",
    "|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|",
  ];

  for (const row of rows) {
    lines.push(
      `| #${row.run} | \`${row.url}\` | ${verdict(row.perf >= BUDGETS.performance)} **${row.perf}/100** | ${row.accessibility}/100 | ${row.bestPractices}/100 | ${row.seo}/100 | ${verdict(row.lcp <= BUDGETS.lcp)} ${(row.lcp / 1000).toFixed(1)}s | ${verdict(row.tbt <= BUDGETS.tbt)} ${Math.round(row.tbt)}ms | ${row.scriptKiB} KiB |`,
    );
  }

  lines.push(
    "",
    `> **Budgets:** Performance ≥ ${BUDGETS.performance} | LCP ≤ ${(BUDGETS.lcp / 1000).toFixed(1)}s | TBT ≤ ${BUDGETS.tbt}ms | Initial scripts ≤ ${BUDGETS.scriptKiB} KiB`,
    "",
    "_Measured against the Vite production build (`vite preview`) with Lighthouse mobile emulation._",
  );

  fs.writeFileSync(outputFile, `${lines.join("\n")}\n`);
  console.log(`Wrote ${runs.length} run(s) to ${outputFile}`);
}

main();
