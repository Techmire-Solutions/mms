import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { resolveBackendRoot } from "../../config/loadEnv.js";
import { initDb } from "../../db/dbInit.js";
import { logger } from "../../lib/logger.js";

const execFileAsync = promisify(execFile);

/** Delay so the HTTP 200 can flush before migrate + process reload. */
export const MIGRATE_RESTART_DELAY_MS = 1_500;

/** PM2 app name from repo-root `ecosystem.config.cjs` — never take from request input. */
const PM2_APP_NAME = "mmsv2-backend";

/** Hardcoded ecosystem filename relative to monorepo root. */
const ECOSYSTEM_FILE = "ecosystem.config.cjs";

// NOTE: this latch is per-process. In a multi-instance (PM2 cluster) deployment
// each instance has its own latch, so two instances could each schedule a
// migrate-and-restart. Acceptable for the current single-instance deployment;
// if clustering is added, move this to a shared store (e.g. Redis).
let migrateRestartInFlight = false;

/** Opt-in gate — remote migrate/reload is disabled unless explicitly enabled. */
export function isRemoteMigrateRestartEnabled(): boolean {
  return process.env.PLATFORM_ALLOW_REMOTE_MIGRATE_RESTART === "true";
}

export function isMigrateRestartInFlight(): boolean {
  return migrateRestartInFlight;
}

/** Test helper — clears the in-flight latch. */
export function resetMigrateRestartLatchForTests(): void {
  migrateRestartInFlight = false;
}

export interface MigrateRestartAuditMeta {
  userId: string;
}

export interface ReloadBackendResult {
  /** True when pm2 reload succeeded or process.exit was scheduled. */
  reloaded: boolean;
}

/**
 * Apply full `initDb` (DDL + data migrations + bootstrap), then reload the PM2 app.
 * Matches ops `pnpm db:migrate` / admin-migrate-and-reload.sh (without closing the pool).
 * Command paths/args are hardcoded — never interpolate request data.
 */
export async function runMigrateAndReload(): Promise<{ ok: true }> {
  logger.info("Applying pending database migrations via initDb...");
  await initDb();
  logger.info("Database migrations applied");
  const { reloaded } = await reloadBackendProcess();
  if (!reloaded) {
    // Process survived (local/dev) — allow another attempt after manual restart.
    migrateRestartInFlight = false;
  }
  return { ok: true };
}

/**
 * Schedule migrate + reload after {@link MIGRATE_RESTART_DELAY_MS}.
 * Returns false if a previous request is already in flight.
 */
export function scheduleMigrateAndRestart(meta: MigrateRestartAuditMeta): boolean {
  if (migrateRestartInFlight) {
    return false;
  }
  migrateRestartInFlight = true;

  logger.error(
    {
      action: "migrate_and_restart_scheduled",
      userId: meta.userId,
      delayMs: MIGRATE_RESTART_DELAY_MS,
      at: new Date().toISOString(),
    },
    "audit",
  );

  const timer = setTimeout(() => {
    void (async () => {
      try {
        await runMigrateAndReload();
        logger.error(
          {
            action: "migrate_and_restart_completed",
            userId: meta.userId,
            at: new Date().toISOString(),
          },
          "audit",
        );
      } catch (error) {
        logger.error({ err: error }, "migrate-and-restart failed");
        logger.error(
          {
            action: "migrate_and_restart_failed",
            userId: meta.userId,
            at: new Date().toISOString(),
          },
          "audit",
        );
        migrateRestartInFlight = false;
      }
    })();
  }, MIGRATE_RESTART_DELAY_MS);
  timer.unref?.();

  return true;
}

/**
 * Reload via hardcoded `pm2 reload <ecosystem> --only mmsv2-backend --update-env`.
 * Falls back to `process.exit(0)` only when production or already under PM2 so a
 * supervising unit can restart us. Skips exit in local/dev to avoid killing node --strip-types.
 */
export async function reloadBackendProcess(): Promise<ReloadBackendResult> {
  const repoRoot = resolve(resolveBackendRoot(), "..", "..");
  const ecosystemPath = join(repoRoot, ECOSYSTEM_FILE);

  try {
    logger.info({ app: PM2_APP_NAME, ecosystem: ecosystemPath }, "Reloading PM2 app");
    await execFileAsync("pm2", ["reload", ecosystemPath, "--only", PM2_APP_NAME, "--update-env"], {
      cwd: repoRoot,
      env: process.env,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    return { reloaded: true };
  } catch (error) {
    logger.warn({ err: error }, "pm2 reload failed; considering process.exit fallback");
  }

  if (shouldExitProcessForReloadFallback()) {
    const exitTimer = setTimeout(() => {
      process.exit(0);
    }, 250);
    exitTimer.unref?.();
    return { reloaded: true };
  }

  logger.warn(
    "Migrations applied but process reload skipped (not production/PM2). Restart the backend manually.",
  );
  return { reloaded: false };
}

function shouldExitProcessForReloadFallback(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.PM2_HOME || process.env.pm_id) return true;
  return false;
}
