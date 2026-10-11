import { ensureFacultyContactIndex } from './migrations/facultyContactIndex.js';
import { dataMigrationsToRun } from './dataMigrationRegistry.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { PoolClient } from 'pg';
import { resolveBackendRoot } from '../config/loadEnv.js';
import { loadServerConfig } from '../config/serverConfig.js';
import { purgeExpiredAuthArtifacts } from '../services/auth/authArtifactService.js';
import { initPlatformSettings } from '../services/platform/platformSettingsService.js';
import { ensurePlatformSuperUserFromEnv } from '../services/platform/platformUserService.js';
import {
  getPool,
  getRootDb,
  initializeDatabaseConnection,
  runInTransaction,
} from './dbConnection.js';
import { saveCollection, saveObject } from './documentStore.js';
import { getMinimalCollectionsForSeed, getMinimalObjects } from './minimalSeeds.js';
import * as schema from './schema.js';
import { logger } from '../lib/logger.js';

const DATA_MIGRATION_LOCK_KEY = 2145836401;
/**
 * Serializes the whole boot pipeline across replicas. Every PM2 cluster instance
 * runs `initDb()`, and only DDL / data migrations were previously lock-serialized;
 * this covers the unguarded seed / platform-sync / partition steps too.
 */
const BOOT_INIT_LOCK_KEY = 2145836403;



/** Resolve Drizzle SQL migrations folder (src in node --strip-types, dist in production). */
export function resolveMigrationsFolder(): string {
  const backendRoot = resolveBackendRoot();
  const srcMigrations = join(backendRoot, 'src/db/migrations_drizzle');
  const distMigrations = join(backendRoot, 'dist/db/migrations_drizzle');
  return existsSync(srcMigrations) ? srcMigrations : distMigrations;
}

/**
 * Apply pending Drizzle DDL migrations only (no data migrations / seed).
 * Safe to call repeatedly — already-applied migrations are no-ops.
 * Schema conflicts fail closed (no “already exists” swallow).
 *
 * Uses a disposable `pg.Client` (never pool.connect/release) so session-scoped
 * `app.rls_bypass=on` cannot poison the shared pool under live traffic.
 */
export async function applyDrizzleMigrations(): Promise<{ migrationsFolder: string }> {
  initializeDatabaseConnection();
  const migrationsFolder = resolveMigrationsFolder();
  const { databaseUrl } = loadServerConfig();
  const migrateClient = new pg.Client({ connectionString: databaseUrl });
  await migrateClient.connect();

  await using _clientDisposer = {
    [Symbol.asyncDispose]: async () => {
      await migrateClient.end().catch(() => undefined);
    },
  };

  await migrateClient.query(`SELECT set_config('app.rls_bypass', 'on', false)`);
  const migrateDb = drizzle(migrateClient, { schema });
  await migrate(migrateDb, { migrationsFolder });
  await ensureFacultyContactIndex(migrateClient);

  return { migrationsFolder };
}

let initDbPromise: Promise<void> | null = null;

export function resetDbInitStateForTesting(): void {
  initDbPromise = null;
}

export function initDb(options?: { force?: boolean }): Promise<void> {
  if (initDbPromise && !options?.force) {
    return initDbPromise;
  }

  initDbPromise = (async () => {
    // Every PM2 cluster instance runs initDb() at boot. Hold one session advisory
    // lock for the whole pipeline so concurrent replicas cannot race the seed,
    // platform-superuser sync, partition provisioning or DDL. The deploy pipeline
    // runs migrateDb.js before reloading, so this is normally a fast no-op pass.
    let bootLockClient: PoolClient | null = null;
    try {
      initializeDatabaseConnection();
      bootLockClient = await getPool().connect();
      await bootLockClient.query('select pg_advisory_lock($1::integer)', [BOOT_INIT_LOCK_KEY]);

      if (process.env.MMS_SKIP_BOOT_MIGRATIONS === 'true') {
        logger.warn('MMS_SKIP_BOOT_MIGRATIONS=true — skipping DDL + data migrations at boot');
      } else {
        await applyDrizzleMigrations();
        await runDataMigrations();
      }

      // Keep the rolling monthly audit partitions ahead of the clock so the
      // DEFAULT partition stays empty and retention can still detach by month.
      const { ensureAuditTrailPartitions } = await import(
        '../services/auditPartitionService.js'
      );
      await ensureAuditTrailPartitions().catch((error: unknown) => {
        // Never block boot on partition provisioning: writes still land in the
        // DEFAULT partition, so this degrades retention rather than availability.
        logger.error({ err: error }, 'Audit partition provisioning failed at boot');
      });

      await purgeExpiredAuthArtifacts();
      await ensurePlatformSuperUserFromEnv();
      const { syncPlatformSuperUserToTenants } = await import(
        '../services/platform/platformSuperUserTenantSyncService.js'
      );
      await syncPlatformSuperUserToTenants();
      await initPlatformSettings();

      const results = await getRootDb().select({ count: sql<number>`count(*)` }).from(schema.workspaces);
      const count = Number(results[0]?.count ?? 0);
      if (count === 0) {
        logger.info('Database is empty. Seeding default collections and objects...');
        await seedDatabase();
      }
    } catch (error) {
      initDbPromise = null;
      logger.error({ err: error }, 'Failed to initialize the database');
      throw error;
    } finally {
      if (bootLockClient) {
        await bootLockClient
          .query('select pg_advisory_unlock($1::integer)', [BOOT_INIT_LOCK_KEY])
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
      await migrationLockClient.query('select pg_advisory_unlock($1::integer)', [DATA_MIGRATION_LOCK_KEY]).catch(() => undefined);
      migrationLockClient.release();
    },
  };

  await migrationLockClient.query('select pg_advisory_lock($1::integer)', [DATA_MIGRATION_LOCK_KEY]);
  await migrationLockClient.query('CREATE TABLE IF NOT EXISTS data_migrations (id text PRIMARY KEY, applied_at timestamp default now() NOT NULL);');

  const applied = await getRootDb().select({ id: schema.dataMigrations.id }).from(schema.dataMigrations);
  const appliedSet = new Set(applied.map((migration) => migration.id));
  for (const migration of dataMigrationsToRun) {
    if (!appliedSet.has(migration.id)) {
      logger.info({ migration: migration.id }, 'Running pending data migration');
      const run = await migration.load();
      await run();
      await getRootDb().insert(schema.dataMigrations).values({ id: migration.id }).onConflictDoNothing();
      appliedSet.add(migration.id);
    }
  }
}

export async function seedDatabase(): Promise<void> {
  try {
    await runInTransaction(async () => {
      for (const [name, collectionItems] of Object.entries(await getMinimalCollectionsForSeed())) {
        await saveCollection(name, collectionItems as unknown[]);
      }
      for (const [key, objectValue] of Object.entries(getMinimalObjects())) {
        await saveObject(key, objectValue);
      }
    });
    logger.info('Database seeding completed successfully.');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed the database');
    throw error;
  }
}
