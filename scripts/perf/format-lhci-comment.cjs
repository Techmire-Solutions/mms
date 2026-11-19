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
 * The pass/fail budgets are NOT duplicated here: they are derived from
 * `lighthouserc.cjs` (the actual CI gate), so the comment's verdict can never
 * drift from what CI enforces. LHCI asserts on the *median* of the runs, so the
 * "CI gate" line reports the median and the per-run rows are informational.
 *
 * Usage: node scripts/perf/format-lhci-comment.cjs [resultsDir] [outputFile]
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const lhciConfig = require(path.join(repoRoot, "lighthouserc.cjs"));
const assertions = lhciConfig?.ci?.assert?.assertions ?? {};

function budgetMinScore(key) {
  const rule = assertions[key];
  if (!Array.isArray(rule)) return null;
  const op = rule.find((x) => x && typeof x === "object" && typeof x.minScore === "number");
  return op ? op.minScore : null;
}

function budgetMaxNumeric(key) {
  const rule = assertions[key];
  if (!Array.isArray(rule)) return null;
  const op = rule.find((x) => x && typeof x === "object" && typeof x.maxNumericValue === "number");
  return op ? op.maxNumericValue : null;
}

// Single source of truth: budgets come from lighthouserc.cjs. The fallbacks are
// only defensive (an assertion missing from the config would otherwise nuke the
// whole comment); edit budgets in lighthouserc.cjs, never here.
const BUDGETS = {
  performance: Math.round((budgetMinScore("categories:performance") ?? 0.55) * 100),
  lcp: budgetMaxNumeric("largest-contentful-paint") ?? 7200,
  tbt: budgetMaxNumeric("total-blocking-time") ?? 300,
  scriptKiB: Math.round((budgetMaxNumeric("resource-summary:script:size") ?? 614400) / 1024),
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

/** Median of finite numeric values; matches LHCI's default aggregation. */
function median(values) {
  const finite = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (finite.length === 0) return 0;
  const sorted = [...finite].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function verdict(passed) {
  return passed ? "✅" : "❌";
}

/**
 * Renders the full PR comment body for the given runs. An empty list produces a
 * fallback so a hard infra failure (build/server/Chrome) still surfaces in the
 * PR instead of a silent red check.
 */
function buildComment(runs) {
  if (runs.length === 0) {
    return (
      [
        "### ⚡ Lighthouse CI Performance Summary",
        "",
        "No Lighthouse results were produced for this run — the check failed before any report was written (build, `vite preview` startup, or Chrome). See the workflow logs for details.",
        "",
      ].join("\n") + "\n"
    );
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

  const medianPerf = median(runs.map((run) => score(run, "performance")));
  const medianLcp = median(runs.map((run) => numeric(run, "largest-contentful-paint")));
  const medianTbt = median(runs.map((run) => numeric(run, "total-blocking-time")));
  const medianScriptKiB = median(runs.map((run) => scriptBytes(run) / 1024));

  const runLabel = `${runs.length} run${runs.length === 1 ? "" : "s"}`;
  const gateMetrics = [
    `Performance **${Math.round(medianPerf)}/100** ${verdict(medianPerf >= BUDGETS.performance)}`,
    `LCP **${(medianLcp / 1000).toFixed(1)}s** ${verdict(medianLcp <= BUDGETS.lcp)}`,
    `TBT **${Math.round(medianTbt)}ms** ${verdict(medianTbt <= BUDGETS.tbt)}`,
    `Initial scripts **${medianScriptKiB.toFixed(1)} KiB** ${verdict(medianScriptKiB <= BUDGETS.scriptKiB)}`,
  ];
  const gateLine = `**CI gate (median of ${runLabel}):** ${gateMetrics.join(" · ")}`;

  const lines = [
    "### ⚡ Lighthouse CI Performance Summary",
    "",
    gateLine,
    "",
    "| Run | URL | Performance | Accessibility | Best Practices | SEO | LCP | TBT | Initial scripts |",
    "|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|",
  ];

  for (const row of rows) {
    lines.push(
      `| #${row.run} | \`${row.url}\` | **${row.perf}/100** | ${row.accessibility}/100 | ${row.bestPractices}/100 | ${row.seo}/100 | ${(row.lcp / 1000).toFixed(1)}s | ${Math.round(row.tbt)}ms | ${row.scriptKiB} KiB |`,
    );
  }

  lines.push(
    "",
    `> **Budgets:** Performance ≥ ${BUDGETS.performance} | LCP ≤ ${(BUDGETS.lcp / 1000).toFixed(1)}s | TBT ≤ ${BUDGETS.tbt}ms | Initial scripts ≤ ${BUDGETS.scriptKiB} KiB`,
    "",
    `_Measured against the Vite production build (\`vite preview\`) with Lighthouse mobile emulation. CI gates on the median of ${runLabel}; individual rows are informational._`,
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const resultsDir = path.resolve(process.argv[2] ?? ".lighthouseci");
  const outputFile = path.resolve(process.argv[3] ?? "lhci-comment.md");
  const runs = readRuns(resultsDir);
  const comment = buildComment(runs);
  fs.writeFileSync(outputFile, comment);
  console.log(
    runs.length > 0
      ? `Wrote ${runs.length} run(s) to ${outputFile}`
      : `No Lighthouse runs found in ${resultsDir}; wrote fallback comment to ${outputFile}`,
  );
}

if (require.main === module) {
  main();
}

module.exports = { BUDGETS, buildComment, median, readRuns, score, numeric, scriptBytes };
