"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { BUDGETS, buildComment, median } = require("./format-lhci-comment.cjs");
const lhciConfig = require(path.resolve(__dirname, "../../lighthouserc.cjs"));

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

test("budgets are derived from lighthouserc.cjs (no drift)", () => {
  const a = lhciConfig.ci.assert.assertions;
  assert.equal(BUDGETS.performance, Math.round(a["categories:performance"][1].minScore * 100));
  assert.equal(BUDGETS.lcp, a["largest-contentful-paint"][1].maxNumericValue);
  assert.equal(BUDGETS.tbt, a["total-blocking-time"][1].maxNumericValue);
  assert.equal(
    BUDGETS.scriptKiB,
    Math.round(a["resource-summary:script:size"][1].maxNumericValue / 1024),
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
  const comment = buildComment(runs);
  assert.match(comment, /CI gate \(median of 3 runs\)/);
  assert.match(comment, /✅/);
  // Per-run rows are informational: no per-run verdict marks.
  assert.doesNotMatch(comment, /\| #1 .*[✅❌]/);
});

test("all-failing median renders the failing verdict", () => {
  const runs = [makeRun({ lcp: 8000 }), makeRun({ lcp: 8100 }), makeRun({ lcp: 8200 })];
  const comment = buildComment(runs);
  assert.match(comment, /❌/);
});

test("empty runs produce a fallback comment", () => {
  const comment = buildComment([]);
  assert.match(comment, /No Lighthouse results were produced/);
});
