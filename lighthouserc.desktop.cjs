/**
 * lighthouserc.desktop.cjs — Lighthouse CI budgets for the desktop (unthrottled)
 * pass of the public MMS entry shell.
 *
 * This reuses the mobile collect settings (URL, 3 runs, `vite preview` server,
 * headless Chrome) and overrides the Lighthouse preset to `desktop` (no CPU or
 * network throttling) plus a desktop-specific assertion set.
 *
 * Desktop lab budgets are conservative placeholders pending a measured desktop
 * baseline: unthrottled desktop scores are CI-runner dependent, so the floors
 * below absorb runner variance while still catching gross boot-path regressions.
 * `resource-summary:script:size` is deterministic for the same build and is the
 * hard guard — identical to mobile.
 *
 * These assertions are the single source of truth for the desktop verdict:
 * `scripts/perf/format-lhci-comment.cjs` derives its pass/fail marks from this
 * file, so the comment always matches what CI actually enforces.
 */
const mobile = require("./lighthouserc.cjs");

module.exports = {
  ci: {
    collect: {
      ...mobile.ci.collect,
      settings: {
        ...mobile.ci.collect.settings,
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        // Conservative floor: unthrottled desktop is expected ≥ 90; 0.75 absorbs
        // CI-runner variance while still catching a boot-path collapse.
        "categories:performance": ["error", { minScore: 0.75 }],
        // Conservative ceiling: unthrottled desktop LCP is expected < 2s.
        "largest-contentful-paint": ["error", { maxNumericValue: 3000 }],
        // Conservative ceiling: unthrottled desktop TBT is expected < 100ms.
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
        // Hard guard: identical deterministic entry-closure transfer bytes as mobile.
        "resource-summary:script:size": ["error", { maxNumericValue: 614400 }],
      },
    },
  },
};
