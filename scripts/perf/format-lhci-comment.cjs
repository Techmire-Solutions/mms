#!/usr/bin/env node
/**
 * Builds the Lighthouse CI PR comment from the raw LHR files written by
 * `@lhci/cli autorun` (`.lighthouseci/lhr-*.json`, moved to
 * `.lighthouseci-mobile` / `.lighthouseci-desktop` by the workflow).
 *
 * LHCI 0.14 does not write `.lighthouseci/manifest.json`, so the previous
 * inline `node -e` summariser always reported "No LHCI manifest found" and the
 * PR comment was never posted. Reading the LHR files directly also lets this
 * run locally with `node scripts/perf/format-lhci-comment.cjs`.
 *
 * The pass/fail budgets are NOT duplicated here: they are derived from
 * `lighthouserc.cjs` (mobile) and `lighthouserc.desktop.cjs` (desktop), so the
 * comment's verdict can never drift from what CI enforces. LHCI asserts on the
 * *median* of each run set, so the "CI gate" line reports the median and the
 * per-run rows are informational.
 *
 * Usage: node scripts/perf/format-lhci-comment.cjs [outputFile]
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const mobileConfig = require(path.join(repoRoot, "lighthouserc.cjs"));
const desktopConfig = require(path.join(repoRoot, "lighthouserc.desktop.cjs"));

function budgetMinScore(assertions, key) {
  const rule = assertions[key];
  if (!Array.isArray(rule)) return null;
  const op = rule.find((x) => x && typeof x === "object" && typeof x.minScore === "number");
  return op ? op.minScore : null;
}

function budgetMaxNumeric(assertions, key) {
  const rule = assertions[key];
  if (!Array.isArray(rule)) return null;
  const op = rule.find((x) => x && typeof x === "object" && typeof x.maxNumericValue === "number");
  return op ? op.maxNumericValue : null;
}

/** Derives the PR-comment budgets from a lighthouserc config's assertions. */
function deriveBudgets(config) {
  const assertions = config?.ci?.assert?.assertions ?? {};
  return {
    performance: Math.round((budgetMinScore(assertions, "categories:performance") ?? 0.55) * 100),
    lcp: budgetMaxNumeric(assertions, "largest-contentful-paint") ?? 7200,
    tbt: budgetMaxNumeric(assertions, "total-blocking-time") ?? 300,
    scriptKiB: Math.round(
      (budgetMaxNumeric(assertions, "resource-summary:script:size") ?? 614400) / 1024,
    ),
  };
}

// Single source of truth: budgets come from the two lighthouserc files. The
// fallbacks are only defensive (a missing assertion would otherwise nuke the
// whole comment); edit budgets in the config files, never here.
const BUDGETS = {
  mobile: deriveBudgets(mobileConfig),
  desktop: deriveBudgets(desktopConfig),
};

/** @returns {Array<Record<string, unknown>>} */
function readRuns(dir) {
  if (!dir || !fs.existsSync(dir)) return [];

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

/** Returns the first non-empty directory's runs (mobile falls back to `.lighthouseci`). */
function readPresetRuns(dirs) {
  for (const dir of dirs) {
    const runs = readRuns(dir);
    if (runs.length > 0) return runs;
  }
  return [];
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

/** Renders one preset's section (heading + gate line + table + budget footnote). */
function renderSection({ icon, title, runs, budgets }) {
  if (runs.length === 0) return null;

  const rows = runs.map((run, index) => ({
    run: index + 1,
    url: run.finalDisplayedUrl ?? run.finalUrl ?? run.requestedUrl ?? "unknown",
    accessibility: score(run, "accessibility"),
    bestPractices: score(run, "best-practices"),
    seo: score(run, "seo"),
    perf: score(run, "performance"),
    lcp: numeric(run, "largest-contentful-paint"),
    tbt: numeric(run, "total-blocking-time"),
    scriptKiB: Math.round((scriptBytes(run) / 1024) * 10) / 10,
  }));

  const medianPerf = median(runs.map((run) => score(run, "performance")));
  const medianLcp = median(runs.map((run) => numeric(run, "largest-contentful-paint")));
  const medianTbt = median(runs.map((run) => numeric(run, "total-blocking-time")));
  const medianScriptKiB = median(runs.map((run) => scriptBytes(run) / 1024));

  const runLabel = `${runs.length} run${runs.length === 1 ? "" : "s"}`;
  const gateMetrics = [
    `Performance **${Math.round(medianPerf)}/100** ${verdict(medianPerf >= budgets.performance)}`,
    `LCP **${(medianLcp / 1000).toFixed(1)}s** ${verdict(medianLcp <= budgets.lcp)}`,
    `TBT **${Math.round(medianTbt)}ms** ${verdict(medianTbt <= budgets.tbt)}`,
    `Initial scripts **${medianScriptKiB.toFixed(1)} KiB** ${verdict(medianScriptKiB <= budgets.scriptKiB)}`,
  ];
  const gateLine = `**CI gate (median of ${runLabel}):** ${gateMetrics.join(" · ")}`;

  const lines = [
    `#### ${icon} ${title}`,
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
    `> **Budgets:** Performance ≥ ${budgets.performance} | LCP ≤ ${(budgets.lcp / 1000).toFixed(1)}s | TBT ≤ ${budgets.tbt}ms | Initial scripts ≤ ${budgets.scriptKiB} KiB`,
    "",
  );

  return lines;
}

/**
 * Renders the full PR comment body for the given mobile/desktop runs. When both
 * lists are empty a fallback is produced so a hard infra failure
 * (build/server/Chrome) still surfaces in the PR instead of a silent red check.
 */
function buildComment({ mobile = [], desktop = [] } = {}) {
  const mobileSection = renderSection({
    icon: "📱",
    title: "Mobile",
    runs: mobile,
    budgets: BUDGETS.mobile,
  });
  const desktopSection = renderSection({
    icon: "🖥️",
    title: "Desktop",
    runs: desktop,
    budgets: BUDGETS.desktop,
  });

  if (!mobileSection && !desktopSection) {
    return (
      [
        "### ⚡ Lighthouse CI Performance Summary",
        "",
        "No Lighthouse results were produced for this run — the check failed before any report was written (build, `vite preview` startup, or Chrome). See the workflow logs for details.",
        "",
      ].join("\n") + "\n"
    );
  }

  const lines = ["### ⚡ Lighthouse CI Performance Summary", ""];
  if (mobileSection) lines.push(...mobileSection);
  if (desktopSection) lines.push(...desktopSection);
  lines.push(
    "_Measured against the Vite production build (`vite preview`) with Lighthouse mobile and desktop emulation. CI gates on the median of each run set; individual rows are informational._",
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const outputFile = path.resolve(process.argv[2] ?? "lhci-comment.md");
  const mobile = readPresetRuns([".lighthouseci-mobile", ".lighthouseci"]);
  const desktop = readPresetRuns([".lighthouseci-desktop"]);
  const comment = buildComment({ mobile, desktop });
  fs.writeFileSync(outputFile, comment);
  console.log(
    mobile.length > 0 || desktop.length > 0
      ? `Wrote ${mobile.length} mobile + ${desktop.length} desktop run(s) to ${outputFile}`
      : `No Lighthouse runs found; wrote fallback comment to ${outputFile}`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  BUDGETS,
  buildComment,
  deriveBudgets,
  median,
  readRuns,
  score,
  numeric,
  scriptBytes,
};
