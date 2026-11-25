import { sql } from "drizzle-orm";
import type { PoolClient } from "pg";
import {
  assertRlsRuntimeRole,
  getPool,
  getRootDb,
  initializeDatabaseConnection,
  runInGlobalTransaction,
} from "@mms/db/client";
import { runWithGlobalTenantScope } from "@mms/db/context";
import { applyDrizzleMigrations, resolveMigrationsFolder } from "@mms/db/migrations";
import * as schema from "@mms/db/schema";
import { getMinimalCollectionsForSeed, getMinimalObjects } from "@mms/db/seed";
import type { PlatformBootServices } from "../bootstrap/bootServices.js";
import { logger } from "../lib/logger.js";
import { saveCollection, saveObject } from "./documentStore.js";
import { runWithGlobalDocumentStore } from "./documentStoreScope.js";
import { dataMigrationsToRun } from "./migrations/dataMigrationRegistry.js";

const DATA_MIGRATION_LOCK_KEY = 2145836401;
/**
 * Serializes the whole boot pipeline across replicas. Every PM2 cluster instance
 * runs `initDb()`, and only DDL / data migrations were previously lock-serialized;
 * this covers the unguarded seed / platform-sync / partition steps too.
 */
const BOOT_INIT_LOCK_KEY = 2145836403;

/**
 * The Drizzle DDL runner and migrations-folder resolution live in `@mms/db`
 * (`@mms/db/migrations`). They stay re-exported here for the app-level migration
 * script and the boot-wiring test; real-Postgres suites import the package entry
 * point directly (`@mms/db/migrations`).
 */
export { applyDrizzleMigrations, resolveMigrationsFolder };

let initDbPromise: Promise<void> | null = null;

export function resetDbInitStateForTesting(): void {
  initDbPromise = null;
}

/**
 * Boot pipeline orchestrator. `services` is required so a caller can never
 * silently skip platform seeding: the app passes `createPlatformBootServices()`
 * via `bootstrap/initializeDatabase.ts`, and the boot test passes stubs.
 * See docs/monorepo-migration-plan.md §8 P1a (U3).
 */
export function initDb(options: {
  services: PlatformBootServices;
  force?: boolean;
}): Promise<void> {
  if (initDbPromise && !options.force) {
    return initDbPromise;
  }
  const { services } = options;

  initDbPromise = (async () => {
    // Every PM2 cluster instance runs initDb() at boot. Hold one session advisory
    // lock for the whole pipeline so concurrent replicas cannot race the seed,
    // platform-superuser sync, partition provisioning or DDL. The deploy pipeline
    // runs migrateDb.js before reloading, so this is normally a fast no-op pass.
    let bootLockClient: PoolClient | null = null;
    try {
      initializeDatabaseConnection();
      // Fail closed when the runtime role makes every FORCE ROW LEVEL SECURITY
      // policy inert (superuser / BYPASSRLS). See db/rlsRoleGuard.ts.
      await assertRlsRuntimeRole(getRootDb());
      bootLockClient = await getPool().connect();
      await bootLockClient.query("select pg_advisory_lock($1::integer)", [BOOT_INIT_LOCK_KEY]);

      if (process.env.MMS_SKIP_BOOT_MIGRATIONS === "true") {
        logger.warn("MMS_SKIP_BOOT_MIGRATIONS=true — skipping DDL + data migrations at boot");
      } else {
        await applyDrizzleMigrations();
        await runDataMigrations();
      }

      // Keep the rolling monthly audit partitions ahead of the clock so the
      // DEFAULT partition stays empty and retention can still detach by month.
      if (services.ensureAuditTrailPartitions) {
        await services.ensureAuditTrailPartitions().catch((error: unknown) => {
          // Never block boot on partition provisioning: writes still land in the
          // DEFAULT partition, so this degrades retention rather than availability.
          logger.error({ err: error }, "Audit partition provisioning failed at boot");
        });
      }

      // Platform bootstrap, in the order the pipeline has always used. Hooks are
      // optional so a script can opt out explicitly (NO_PLATFORM_BOOT_SERVICES).
      await services.purgeExpiredAuthArtifacts?.();
      await services.ensurePlatformSuperUser?.();
      await services.syncPlatformSuperUserToTenants?.();
      await services.initPlatformSettings?.();
      await services.initPlatformBranding?.();

      const results = await getRootDb()
        .select({ count: sql<number>`count(*)` })
        .from(schema.workspaces);
      const count = Number(results[0]?.count ?? 0);
      if (count === 0) {
        logger.info("Database is empty. Seeding default collections and objects...");
        await seedDatabase();
      }
    } catch (error) {
      initDbPromise = null;
      logger.error({ err: error }, "Failed to initialize the database");
      throw error;
    } finally {
      if (bootLockClient) {
        await bootLockClient
          .query("select pg_advisory_unlock($1::integer)", [BOOT_INIT_LOCK_KEY])
          .catch(() => undefined);
        bootLockClient.release();
      }
    }
  })();

  return initDbPromise;
}

async function runDataMigrations(): Promise<void> {
  const migrationLockClient = await getPool().connect();

  await using _lockDisposer = {
    [Symbol.asyncDispose]: async () => {
      await migrationLockClient
        .query("select pg_advisory_unlock($1::integer)", [DATA_MIGRATION_LOCK_KEY])
        .catch(() => undefined);
      migrationLockClient.release();
    },
  };

  await migrationLockClient.query("select pg_advisory_lock($1::integer)", [
    DATA_MIGRATION_LOCK_KEY,
  ]);
  await migrationLockClient.query(
    "CREATE TABLE IF NOT EXISTS data_migrations (id text PRIMARY KEY, applied_at timestamp default now() NOT NULL);",
  );

  const applied = await getRootDb()
    .select({ id: schema.dataMigrations.id })
    .from(schema.dataMigrations);
  const appliedSet = new Set(applied.map((migration) => migration.id));
  for (const migration of dataMigrationsToRun) {
    if (!appliedSet.has(migration.id)) {
      logger.info({ migration: migration.id }, "Running pending data migration");
      const run = await migration.load();
      // Data migrations run with no request context and rewrite the document
      // store for every workspace. They are already applied on deployed
      // databases (forward-only: they cannot be edited to pass `allowGlobal`), so
      // boot wraps them in the explicit ambient scopes instead of leaving the
      // tenant guard silently fail-open for everyone.
      await runWithGlobalDocumentStore(() =>
        runWithGlobalTenantScope(async () => {
          await run();
        }),
      );
      await getRootDb()
        .insert(schema.dataMigrations)
        .values({ id: migration.id })
        .onConflictDoNothing();
      appliedSet.add(migration.id);
    }
  }
}

export async function seedDatabase(): Promise<void> {
  try {
    await runWithGlobalDocumentStore(() =>
      runInGlobalTransaction(async () => {
        for (const [name, collectionItems] of Object.entries(
          await getMinimalCollectionsForSeed(),
        )) {
          await saveCollection(name, collectionItems as unknown[]);
        }
        for (const [key, objectValue] of Object.entries(getMinimalObjects())) {
          await saveObject(key, objectValue);
        }
      }),
    );
    logger.info("Database seeding completed successfully.");
  } catch (error) {
    logger.error({ err: error }, "Failed to seed the database");
    throw error;
  }
}
