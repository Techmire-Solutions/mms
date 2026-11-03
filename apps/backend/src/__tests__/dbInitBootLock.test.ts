import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { clientQuery, releaseMock, pgClientQuery, pgClientConnect, pgClientEnd } = vi.hoisted(() => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const release = vi.fn();
  const pgQuery = vi.fn().mockResolvedValue({ rows: [] });
  const pgConnect = vi.fn().mockResolvedValue(undefined);
  const pgEnd = vi.fn().mockResolvedValue(undefined);
  return {
    clientQuery: query,
    releaseMock: release,
    pgClientQuery: pgQuery,
    pgClientConnect: pgConnect,
    pgClientEnd: pgEnd,
  };
});

vi.mock("pg", () => {
  class MockClient {
    connect = pgClientConnect;
    query = pgClientQuery;
    end = pgClientEnd;
  }
  return { default: { Client: MockClient } };
});

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}));

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../config/serverConfig.js", () => ({
  loadServerConfig: vi.fn().mockReturnValue({ databaseUrl: "postgres://mock:5432/mms" }),
}));

vi.mock("../db/dataMigrationRegistry.js", () => ({ dataMigrationsToRun: [] }));

vi.mock("../db/dbConnection.js", () => ({
  initializeDatabaseConnection: vi.fn(),
  getPool: () => ({ connect: async () => ({ query: clientQuery, release: releaseMock }) }),
  getRootDb: () => ({ select: () => ({ from: async () => [{ count: 1 }] }) }),
  runInTransaction: async (cb: () => Promise<unknown>) => cb(),
  runInGlobalTransaction: async (cb: () => Promise<unknown>) => cb(),
}));

vi.mock("../db/migrations/facultyContactIndex.js", () => ({
  ensureFacultyContactIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../db/contactSystemTagsPreMigration.js", () => ({
  prepareContactSystemTagsPreMigration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/platform/platformSettingsService.js", () => ({
  initPlatformSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/platform/platformUserService.js", () => ({
  ensurePlatformSuperUserFromEnv: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/platform/platformSuperUserTenantSyncService.js", () => ({
  syncPlatformSuperUserToTenants: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/auditPartitionService.js", () => ({
  ensureAuditTrailPartitions: vi.fn().mockResolvedValue(undefined),
}));

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { ensureFacultyContactIndex } from "../db/migrations/facultyContactIndex.js";
import { prepareContactSystemTagsPreMigration } from "../db/contactSystemTagsPreMigration.js";
import {
  initDb,
  resetDbInitStateForTesting,
  resolveMigrationsFolder,
  applyDrizzleMigrations,
} from "../db/dbInit.js";

describe("dbInit suite", () => {
  const originalSkip = process.env.MMS_SKIP_BOOT_MIGRATIONS;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clientQuery.mockClear();
    releaseMock.mockClear();
    pgClientQuery.mockClear();
    pgClientConnect.mockClear();
    pgClientEnd.mockClear();
    vi.mocked(migrate).mockClear();
    vi.mocked(prepareContactSystemTagsPreMigration).mockClear();
    vi.mocked(ensureFacultyContactIndex).mockClear();
    resetDbInitStateForTesting();
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.MMS_SKIP_BOOT_MIGRATIONS;
    else process.env.MMS_SKIP_BOOT_MIGRATIONS = originalSkip;
    process.env.NODE_ENV = originalEnv;
  });

  describe("resolveMigrationsFolder", () => {
    it("returns a valid migrations directory string", () => {
      const folder = resolveMigrationsFolder();
      expect(typeof folder).toBe("string");
      expect(folder).toContain("migrations_drizzle");
    });
  });

  describe("applyDrizzleMigrations", () => {
    it("executes migrations pipeline with lock timeout and pre-migration hook", async () => {
      const result = await applyDrizzleMigrations();

      expect(pgClientConnect).toHaveBeenCalledTimes(1);
      expect(pgClientQuery).toHaveBeenCalledWith(
        "SELECT set_config('app.rls_bypass', 'on', false)",
      );
      expect(pgClientQuery).toHaveBeenCalledWith("SET lock_timeout = '2s'");
      expect(prepareContactSystemTagsPreMigration).toHaveBeenCalledTimes(1);
      expect(migrate).toHaveBeenCalledTimes(1);
      expect(pgClientQuery).toHaveBeenCalledWith("SET lock_timeout = 0");
      expect(ensureFacultyContactIndex).toHaveBeenCalledTimes(1);
      expect(result.migrationsFolder).toContain("migrations_drizzle");
    });
  });

  describe("initDb boot lock", () => {
    it("acquires and releases the boot lock, and skips migrations when MMS_SKIP_BOOT_MIGRATIONS=true", async () => {
      process.env.MMS_SKIP_BOOT_MIGRATIONS = "true";

      await initDb({ force: true });

      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_lock($1::integer)",
        [2145836403],
      );
      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_unlock($1::integer)",
        [2145836403],
      );
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(migrate).not.toHaveBeenCalled();
    });

    it("runs migrations when MMS_SKIP_BOOT_MIGRATIONS is not true", async () => {
      delete process.env.MMS_SKIP_BOOT_MIGRATIONS;

      await initDb({ force: true });

      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_lock($1::integer)",
        [2145836403],
      );
      expect(prepareContactSystemTagsPreMigration).toHaveBeenCalledTimes(1);
      expect(migrate).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_unlock($1::integer)",
        [2145836403],
      );
    });
  });
});
