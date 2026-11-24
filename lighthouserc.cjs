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
 *
 * These assertions are the single source of truth: `scripts/perf/format-lhci-comment.cjs`
 * derives its PR-comment pass/fail marks from this file, so the comment's verdict
 * always matches what CI actually enforces (median of the runs). The desktop
 * (unthrottled) pass lives in `lighthouserc.desktop.cjs`.
 *
 * There is no `upload` target: reports stay local to the run, and the PR comment
 * is the durable artifact (a `temporary-public-storage` upload would only add an
 * ephemeral 7-day public report plus a GitHub App dependency, duplicating the
 * comment).
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
        "categories:performance": ["error", { minScore: 0.5 }],
        // Measured baseline: LCP ≈ 6.4s simulated mobile. 7.2s allows variance.
        "largest-contentful-paint": ["error", { maxNumericValue: 7200 }],
        // Measured baseline: TBT ≈ 40–150ms.
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        // 610 KiB. Measured baseline: ≈ 605 KiB for the entry closure (incorporates platform 3-tier modules + i18n).
        "resource-summary:script:size": ["error", { maxNumericValue: 624640 }],
      },
    },
  },
};
