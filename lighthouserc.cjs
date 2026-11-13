/**
 * lighthouserc.cjs — Lighthouse CI budgets for the public MMS entry shell.
 *
 * What is measured
 * ----------------
 * `vite preview` (production build) of the unauthenticated entry: `/` resolves
 * the host, renders the app-shell skeleton and, on an apex host, redirects to
 * `/platform/login`. The authenticated tenant dashboard needs a backend session
 * and is therefore NOT part of this lab run — treat these budgets as a
 * regression ratchet for the first paint + boot path, not a dashboard score.
 *
 * Budget policy
 * -------------
 * The numbers below are the measured baseline of the skeleton/bundle work
 * (see docs: perf/BASELINE.md) plus a small margin for CI runner variance and
 * for byte-level growth. They are deliberately ratchets: lower them (and the
 * documented baseline) whenever a change improves the numbers; never raise one
 * to make a regression pass without re-measuring the baseline first.
 *
 * `resource-summary:script:size` is deterministic for a given build (transfer
 * bytes), so it has the tightest headroom and is the hard guard against
 * bundle bloat.
 */
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:4173/"],
      numberOfRuns: 3,
      startServerCommand: "pnpm --filter mms-frontend exec vite preview --port 4173 --strictPort",
      startServerReadyPattern: "http://localhost:4173",
      startServerReadyTimeout: 60000,
      settings: {
        chromeFlags: "--headless=new --no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        // Measured baseline: perf 59 (median of 3). Floor keeps runner noise out.
        "categories:performance": ["error", { minScore: 0.55 }],
        // Measured baseline: LCP ≈ 6.4s simulated mobile. 7.2s allows variance.
        "largest-contentful-paint": ["error", { maxNumericValue: 7200 }],
        // Measured baseline: TBT ≈ 40–150ms.
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        // 600 KiB. Measured baseline: ≈ 575 KiB for the entry closure (deterministic).
        "resource-summary:script:size": ["error", { maxNumericValue: 614400 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
