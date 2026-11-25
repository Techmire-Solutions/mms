/**
 * Database runtime configuration for `@mms/db`.
 *
 * The package must be usable from the API, the worker, migration scripts and
 * unit tests without importing the backend's `config/serverConfig` (that would
 * invert the dependency direction). It therefore resolves the same environment
 * variables with the same defaults, and exposes `configureDbConfig()` so the
 * application can hand over its already-validated server config at boot.
 */
export interface DbRuntimeConfig {
  databaseUrl: string;
  readReplicaDatabaseUrl: string;
  pgPoolMax: number;
  pgStatementTimeoutMs: number;
  pgIdleInTxTimeoutMs: number;
  isProd: boolean;
  isTest: boolean;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

let overrides: Partial<DbRuntimeConfig> = {};

/** Override resolved configuration (used by the app boot and by tests). */
export function configureDbConfig(overridesIn: Partial<DbRuntimeConfig>): void {
  overrides = { ...overrides, ...overridesIn };
}

/** Clear runtime overrides (tests only). */
export function resetDbConfigForTesting(): void {
  overrides = {};
}

/**
 * Resolve DB configuration. Mirrors the backend's `loadServerConfig` values for
 * the fields the data layer consumes, including the test fallback URL.
 */
export function loadServerConfig(): DbRuntimeConfig {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const databaseUrl =
    process.env.DATABASE_URL ?? (isTest ? "postgres://postgres:postgres@localhost:5432/mms" : "");
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required but not set. " +
        "Set it in your .env file or deployment environment before starting the server.",
    );
  }
  return {
    databaseUrl,
    readReplicaDatabaseUrl: process.env.READ_REPLICA_DATABASE_URL || databaseUrl,
    pgPoolMax: parsePositiveInt(process.env.PG_POOL_MAX, 20, 1, 100),
    pgStatementTimeoutMs: parsePositiveInt(process.env.PG_STATEMENT_TIMEOUT_MS, 30_000, 1, 600_000),
    pgIdleInTxTimeoutMs: parsePositiveInt(process.env.PG_IDLE_IN_TX_TIMEOUT_MS, 15_000, 1, 600_000),
    isProd: process.env.NODE_ENV === "production",
    isTest,
    ...overrides,
  };
}
