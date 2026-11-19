"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { BUDGETS, buildComment, median } = require("./format-lhci-comment.cjs");
const mobileConfig = require(path.resolve(__dirname, "../../lighthouserc.cjs"));
const desktopConfig = require(path.resolve(__dirname, "../../lighthouserc.desktop.cjs"));

function makeRun({ perf = 0.59, lcp = 6400, tbt = 50, scriptBytes = 575 * 1024 } = {}) {
  return {
    finalDisplayedUrl: "http://localhost:4173/",
    categories: {
      performance: { score: perf },
      accessibility: { score: 1 },
      "best-practices": { score: 1 },
      seo: { score: 1 },
    },
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "total-blocking-time": { numericValue: tbt },
      "resource-summary": {
        details: { items: [{ resourceType: "script", transferSize: scriptBytes }] },
      },
    },
  };
}

test("mobile budgets are derived from lighthouserc.cjs (no drift)", () => {
  const a = mobileConfig.ci.assert.assertions;
  assert.equal(
    BUDGETS.mobile.performance,
    Math.round(a["categories:performance"][1].minScore * 100),
  );
  assert.equal(BUDGETS.mobile.lcp, a["largest-contentful-paint"][1].maxNumericValue);
  assert.equal(BUDGETS.mobile.tbt, a["total-blocking-time"][1].maxNumericValue);
  assert.equal(
    BUDGETS.mobile.scriptKiB,
    Math.round(a["resource-summary:script:size"][1].maxNumericValue / 1024),
  );
});

test("desktop budgets are derived from lighthouserc.desktop.cjs (no drift)", () => {
  const a = desktopConfig.ci.assert.assertions;
  assert.equal(
    BUDGETS.desktop.performance,
    Math.round(a["categories:performance"][1].minScore * 100),
  );
  assert.equal(BUDGETS.desktop.lcp, a["largest-contentful-paint"][1].maxNumericValue);
  assert.equal(BUDGETS.desktop.tbt, a["total-blocking-time"][1].maxNumericValue);
  assert.equal(
    BUDGETS.desktop.scriptKiB,
    Math.round(a["resource-summary:script:size"][1].maxNumericValue / 1024),
  );
});

test("desktop collect inherits mobile settings and overrides preset", () => {
  assert.equal(desktopConfig.ci.collect.url[0], mobileConfig.ci.collect.url[0]);
  assert.equal(desktopConfig.ci.collect.numberOfRuns, mobileConfig.ci.collect.numberOfRuns);
  assert.equal(desktopConfig.ci.collect.settings.preset, "desktop");
  assert.equal(
    desktopConfig.ci.collect.settings.chromeFlags,
    mobileConfig.ci.collect.settings.chromeFlags,
  );
});

test("median picks the middle value and ignores non-finite", () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([5]), 5);
  assert.equal(median([1, NaN, 3, undefined]), 2);
  assert.equal(median([]), 0);
});

test("gate verdict uses the median, not per-run values", () => {
  // Two passing runs + one noisy failing run: the median passes, CI passes.
  const runs = [makeRun({ lcp: 6000 }), makeRun({ lcp: 6400 }), makeRun({ lcp: 7300 })];
  const comment = buildComment({ mobile: runs });
  assert.match(comment, /CI gate \(median of 3 runs\)/);
  assert.match(comment, /✅/);
  // Per-run rows are informational: no per-run verdict marks.
  assert.doesNotMatch(comment, /\| #1 .*[✅❌]/);
});

test("all-failing median renders the failing verdict", () => {
  const runs = [makeRun({ lcp: 8000 }), makeRun({ lcp: 8100 }), makeRun({ lcp: 8200 })];
  const comment = buildComment({ mobile: runs });
  assert.match(comment, /❌/);
});

test("desktop section renders with its own budget", () => {
  const runs = [makeRun({ perf: 0.92, lcp: 900, tbt: 20 })];
  const comment = buildComment({ desktop: runs });
  assert.match(comment, /🖥️ Desktop/);
  assert.match(comment, /Performance ≥ 75/);
  assert.match(comment, /LCP ≤ 3\.0s/);
});

test("both sections render when both run sets exist", () => {
  const comment = buildComment({ mobile: [makeRun()], desktop: [makeRun({ lcp: 900 })] });
  assert.match(comment, /📱 Mobile/);
  assert.match(comment, /🖥️ Desktop/);
});

test("empty run sets produce a fallback comment", () => {
  const comment = buildComment({});
  assert.match(comment, /No Lighthouse results were produced/);
});
