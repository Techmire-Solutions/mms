import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabaseConnection, pingDatabase } from "@mms/db/client";

/**
 * Support for the OPT-IN real-Postgres suite (`vitest.db.config.ts`, run via
 * `pnpm --filter mms-api test:db`).
 *
 * `mms-testing-observability.mdc` §1 bans conditionally-skipping tests
 * (`if (!isDbAvailable) return;`). A silent skip is worse than a failure: the
 * suite reports green while never asserting anything, so a broken query or a
 * dropped migration passes CI unnoticed.
 *
 * These suites exist precisely because some behaviour cannot be verified with
 * mocks — PostgreSQL `read only` transaction enforcement, RLS isolation between
 * workspaces — so they run for real and FAIL LOUDLY when no database is
 * reachable. That is safe here because the suite is never part of the default
 * `pnpm test` run, and CI provides a Postgres service for it.
 */

const backendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "apps",
  "api",
);

/** Populates DATABASE_URL from apps/api/.env when the environment has none. */
function applyDatabaseUrlFromEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  try {
    const content = readFileSync(join(backendRoot, ".env"), "utf-8");
    const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // No .env present — loadServerConfig falls back to its test default.
  }
}

/**
 * Connects to the database or throws with an actionable message.
 *
 * Call from `beforeAll`. Throwing there fails the whole file rather than
 * skipping it, which is the behaviour the rule requires.
 */
export async function requireDatabaseConnection(): Promise<void> {
  applyDatabaseUrlFromEnvFile();
  initializeDatabaseConnection();

  if (!(await pingDatabase())) {
    throw new Error(
      "This suite requires a reachable PostgreSQL instance and will not skip silently.\n" +
        `  DATABASE_URL: ${process.env.DATABASE_URL ?? "(unset — expected apps/api/.env)"}\n` +
        "  Start the dev database, or run the default suite (`pnpm test`) which excludes\n" +
        "  src/__tests__/db-integration/** entirely.",
    );
  }

  // DB suites import module use-cases directly (not through `buildApp()`), so they must
  // bind the contacts module's kernel deps exactly as the app composition root does;
  // otherwise every contact write throws "Contacts kernel deps are not configured".
}

/** Random per-run tenant subdomain so a reused database cannot collide with stale rows. */
export function uniqueTenant(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/** UTC today as YYYY-MM-DD; computed at call time (never at module import). */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A date N days from today (negative = past), for rules that depend on "today". */
export function daysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Extracts the underlying PostgreSQL error code, unwrapping Drizzle/driver wrappers if present. */
export function extractPgErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  if ("cause" in error) {
    return extractPgErrorCode((error as { cause?: unknown }).cause);
  }
  return undefined;
}
