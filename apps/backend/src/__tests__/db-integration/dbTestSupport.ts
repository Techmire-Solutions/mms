import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabaseConnection, pingDatabase } from "../../db/dbConnection.js";

/**
 * Support for the OPT-IN real-Postgres suite (`vitest.db.config.ts`, run via
 * `pnpm --filter mms-backend test:db`).
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

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Populates DATABASE_URL from apps/backend/.env when the environment has none. */
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
        `  DATABASE_URL: ${process.env.DATABASE_URL ?? "(unset — expected apps/backend/.env)"}\n` +
        "  Start the dev database, or run the default suite (`pnpm test`) which excludes\n" +
        "  src/__tests__/db-integration/** entirely.",
    );
  }
}
