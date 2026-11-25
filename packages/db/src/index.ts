/**
 * `@mms/db` — the MMS data layer.
 *
 * Owns the Drizzle schema, forward-only DDL migrations, seed fixtures, soft-delete
 * helpers and the centralized tenant-scoped client (`withTenant` /
 * `withTenantRead` / `withGlobalTenant`, plus the audited `bypassTenantScope`).
 *
 * Subpath entries:
 * - `@mms/db/schema`   Drizzle tables/relations (also `@mms/db/schema/<file>`).
 * - `@mms/db/client`   pool, root/tenant handles, transactions, prepared statements.
 * - `@mms/db/context`  request tenant storage + tenant-scoped transaction helpers.
 * - `@mms/db/soft-delete` soft-delete query helpers.
 * - `@mms/db/migrations` Drizzle migration runner + folder resolution.
 * - `@mms/db/seed`     seed fixtures and the minimal in-code seed.
 * - `@mms/db/testing`  reset/registration helpers for tests.
 */
export * from "./client.js";
export * from "./context.js";
export * from "./scope.js";
export * from "./listPageHelper.js";
export * from "./repositoryMappers.js";
export * from "./workspaceRepositoryCache.js";
export * from "./workspaceTimezone.js";
export * from "./soft-delete/index.js";
export * from "./seed/index.js";
export * from "./runtime/config.js";
export * from "./runtime/errors.js";
export * from "./runtime/logger.js";
export * from "./runtime/logRedaction.js";
export * from "./runtime/telemetry.js";
export { applyDrizzleMigrations, resolveMigrationsFolder } from "./migrations.js";
export * from "./academicCatalogReferences.js";
export * from "./academicCatalogSnapshot.js";
export * from "./academicCatalogNameSql.js";
export * from "./sequenceNumberAllocator.js";
