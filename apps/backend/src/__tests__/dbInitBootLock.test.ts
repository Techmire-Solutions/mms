import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { clientQuery, releaseMock } = vi.hoisted(() => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const release = vi.fn();
  return { clientQuery: query, releaseMock: release };
});

vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
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
import { initDb, resetDbInitStateForTesting } from "../db/dbInit.js";

describe("initDb boot lock", () => {
  const originalSkip = process.env.MMS_SKIP_BOOT_MIGRATIONS;

  beforeEach(() => {
    clientQuery.mockClear();
    releaseMock.mockClear();
    vi.mocked(migrate).mockClear();
    resetDbInitStateForTesting();
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.MMS_SKIP_BOOT_MIGRATIONS;
    else process.env.MMS_SKIP_BOOT_MIGRATIONS = originalSkip;
  });

  it("acquires and releases the boot lock, and skips migrations when MMS_SKIP_BOOT_MIGRATIONS=true", async () => {
    process.env.MMS_SKIP_BOOT_MIGRATIONS = "true";

    await initDb({ force: true });

    expect(clientQuery).toHaveBeenCalledWith("select pg_advisory_lock($1::integer)", [2145836403]);
    expect(clientQuery).toHaveBeenCalledWith(
      "select pg_advisory_unlock($1::integer)",
      [2145836403],
    );
    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(migrate).not.toHaveBeenCalled();
  });
});
