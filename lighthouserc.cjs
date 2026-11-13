/**
 * lighthouserc.cjs - Lighthouse CI Configuration for MMS
 * 3 runs each for Mobile and Desktop against Vite production preview.
 */
module.exports = {
  ci: {
    collect: {
      url: ["http://localhost:4173/"],
      numberOfRuns: 3,
      startServerCommand: "pnpm --filter mms-frontend exec vite preview --port 4173 --strictPort",
      startServerReadyPattern: "Local:",
      startServerReadyTimeout: 30000,
      settings: {
        chromeFlags: "--headless=new --no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.7 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "total-blocking-time": ["error", { maxNumericValue: 300 }],
        "resource-summary:script:size": ["error", { maxNumericValue: 204800 }], // 200 KiB gzip
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
