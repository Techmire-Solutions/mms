/**
 * Drizzle DDL migration runner + migration-folder resolution.
 *
 * Owns the parts of database provisioning that are pure data-layer concerns:
 *
 * 1. the forward-only Drizzle migrations in `packages/db/migrations_drizzle`,
 * 2. the pre-migration contact-tag preparation,
 * 3. the CONCURRENTLY-only index builds that cannot live inside a transactional
 *    Drizzle migration (`ddl-maintenance/**`).
 *
 * Application bootstrapping (seeds, platform sync, audit partitions) stays in the
 * backend's `db/dbInit.ts`, which calls `applyDrizzleMigrations()` from here.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { getRootDb, initializeDatabaseConnection } from "./dbConnection.js";
import { assertRlsRuntimeRole } from "./rlsRoleGuard.js";
import { prepareContactSystemTagsPreMigration } from "./ddl-maintenance/contactSystemTagsPreMigration.js";
import { ensureFacultyContactIndex } from "./ddl-maintenance/facultyContactIndex.js";
import { ensureEnrollmentIntegrityIndexes } from "./ddl-maintenance/enrollmentIntegrityIndexes.js";
import { ensureAttendanceAnalyticsIndexes } from "./ddl-maintenance/attendanceAnalyticsIndexes.js";
import { ensureFinanceConcurrentIndexes } from "./ddl-maintenance/financeConcurrentIndexes.js";
import { loadServerConfig } from "./runtime/config.js";
import * as schema from "./schema.js";

/**
 * Resolve the Drizzle SQL migrations folder.
 *
 * The folder lives at the package root (`packages/db/migrations_drizzle`), so the
 * same `../migrations_drizzle` relative path works from both `src/` (tsx /
 * --experimental-strip-types) and `dist/` (compiled).
 */
export function resolveMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "migrations_drizzle"),
    join(here, "..", "..", "migrations_drizzle"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not locate the Drizzle migrations folder. Looked in: ${candidates.join(", ")}.`,
  );
}

/**
 * Apply pending Drizzle DDL migrations only (no data migrations / seed).
 * Safe to call repeatedly — already-applied migrations are no-ops.
 * Schema conflicts fail closed (no "already exists" swallow).
 *
 * Uses a disposable `pg.Client` (never pool.connect/release) so session-scoped
 * `app.rls_bypass=on` cannot poison the shared pool under live traffic.
 */
export async function applyDrizzleMigrations(): Promise<{ migrationsFolder: string }> {
  initializeDatabaseConnection();
  await assertRlsRuntimeRole(getRootDb());

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
  // Bound every migration's lock wait centrally: applied migrations are
  // forward-only and some predate the lock_timeout preamble.
  await migrateClient.query(`SET lock_timeout = '2s'`);
  await prepareContactSystemTagsPreMigration(migrateClient);
  const migrateDb = drizzle(migrateClient, { schema });
  await migrate(migrateDb, { migrationsFolder });
  await migrateClient.query(`SET lock_timeout = 0`);
  await ensureFacultyContactIndex(migrateClient);
  // Enrollments' unique/seat indexes are CONCURRENTLY-only (populated table) and were
  // previously manual scripts; provisioning them here is what makes a fresh database
  // and every existing deployment actually enforce them.
  await ensureEnrollmentIntegrityIndexes(migrateClient);
  // Attendance's analytics covering indexes are CONCURRENTLY-only for the same reason
  // (populated table, migrator transaction); provisioning them here makes them exist.
  await ensureAttendanceAnalyticsIndexes(migrateClient);
  // Finance directory indexes: finance_invoices/finance_payments are large tables, so
  // their indexes are CONCURRENTLY-only and provisioned here (0248 audit).
  await ensureFinanceConcurrentIndexes(migrateClient);

  return { migrationsFolder };
}

// Re-exported so tests and boot code can invoke the CONCURRENTLY-only maintenance
// steps directly (they are part of the migration contract, not private helpers).
export { ensureFacultyContactIndex } from "./ddl-maintenance/facultyContactIndex.js";
export { ensureEnrollmentIntegrityIndexes } from "./ddl-maintenance/enrollmentIntegrityIndexes.js";
export { ensureAttendanceAnalyticsIndexes } from "./ddl-maintenance/attendanceAnalyticsIndexes.js";
export {
  ensureFinanceConcurrentIndexes,
  FINANCE_CONCURRENT_INDEXES,
} from "./ddl-maintenance/financeConcurrentIndexes.js";
export {
  prepareContactSystemTagsPreMigration,
  CONTACT_TAG_PRE_MIGRATION_CLEANUP,
} from "./ddl-maintenance/contactSystemTagsPreMigration.js";
