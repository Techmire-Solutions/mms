import { defineConfig, devices } from "@playwright/test";

// Ensure JWT_SECRET is set for the backend dev server in CI/test environments
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-jwt-secret-key-at-least-32-chars-long";

const isProduction =
  process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";
const skipWebServer = isProduction || Boolean(process.env.NO_WEB_SERVER);

/** Specs that mutate shared state and are restricted to local single-run environments. */
const LOCAL_ONLY_SPECS = [
  "**/contacts-import-export.spec.ts",
  "**/platform-onboarding.spec.ts",
  "**/responsive-authenticated.spec.ts",
  "**/template-editor.spec.ts",
  "**/tenant-academic-flow.spec.ts",
  "**/tenant-critical-lifecycles.spec.ts",
  "**/tenant-operations-flow.spec.ts",
] as const;

/** Heavy mutation/seed flows excluded when running against production environments. */
const PRODUCTION_IGNORED_SPECS = [
  "**/platform-onboarding.spec.ts",
  "**/tenant-operations-flow.spec.ts",
  "**/tenant-academic-flow.spec.ts",
  "**/responsive-authenticated.spec.ts",
] as const;

const ignoredSpecs = [
  ...(isProduction ? PRODUCTION_IGNORED_SPECS : []),
  ...(process.env.CI ? LOCAL_ONLY_SPECS : []),
];

/**
 * Long axe sweeps, split one sweep per test. A separate project so CI shards
 * them on their own runners: sharding hands each runner a contiguous slice of
 * tests by count, which put every long test on shard 1.
 */
const A11Y_SWEEP_SPECS = ["**/a11y-shell.spec.ts"];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Ignore heavy mutation/seed flows on production targets or CI local-only specs */
  testIgnore: ignoredSpecs,
  /* Skip heavy local-only tests on CI */
  grepInvert: process.env.CI ? /@local-only/ : undefined,
  /* Maximum time one test can run for. */
  timeout: 45 * 1000,
  expect: {
    timeout: process.env.CI ? 10 * 1000 : 5 * 1000,
  },
  /* Allow granular test sharding across runners; workers: 1 preserves sequential DB safety per runner */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Shared database/state per runner: use 1 worker; GitHub Actions matrix handles cross-runner sharding. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [["github"], ["blob", { outputDir: "blob-report" }]]
    : [["html", { open: "never" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
    reducedMotion: "reduce",
  },

  /* Configure projects for major browsers (a project testIgnore replaces the top-level one) */
  projects: [
    {
      name: "chromium",
      testIgnore: [...ignoredSpecs, ...A11Y_SWEEP_SPECS],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "a11y",
      testMatch: A11Y_SWEEP_SPECS,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Run local dev server only when not running against external/production server */
  webServer: skipWebServer
    ? undefined
    : {
        command: "node e2e/scripts/start-web-server.mjs",
        cwd: "..",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 90 * 1000,
        stdout: process.env.CI ? "pipe" : "ignore",
        stderr: "pipe",
      },
});
