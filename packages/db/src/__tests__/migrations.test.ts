import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * DDL migration pipeline (`applyDrizzleMigrations`).
 *
 * The postgres client, drizzle migrator and the CONCURRENTLY index provisions are
 * mocked; the test asserts the ordering and the session-safety contract (RLS
 * bypass + lock timeout around the migrator, timeout cleared afterwards).
 */
const {
  pgClientQuery,
  pgClientConnect,
  pgClientEnd,
  migrateMock,
  ensureFacultyMock,
  ensureEnrollmentMock,
  ensureAttendanceMock,
  ensureFinanceMock,
  prepareContactTagsMock,
} = vi.hoisted(() => ({
  pgClientQuery: vi.fn().mockResolvedValue({ rows: [] }),
  pgClientConnect: vi.fn().mockResolvedValue(undefined),
  pgClientEnd: vi.fn().mockResolvedValue(undefined),
  migrateMock: vi.fn().mockResolvedValue(undefined),
  ensureFacultyMock: vi.fn().mockResolvedValue(undefined),
  ensureEnrollmentMock: vi.fn().mockResolvedValue(undefined),
  ensureAttendanceMock: vi.fn().mockResolvedValue(undefined),
  ensureFinanceMock: vi.fn().mockResolvedValue(undefined),
  prepareContactTagsMock: vi.fn().mockResolvedValue(undefined),
}));

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
  migrate: migrateMock,
}));

vi.mock("../dbConnection.js", () => ({
  initializeDatabaseConnection: vi.fn(),
  getRootDb: () => ({ query: vi.fn() }),
}));

vi.mock("../rlsRoleGuard.js", () => ({
  assertRlsRuntimeRole: vi.fn().mockResolvedValue({
    role: "mocked",
    isSuperuser: false,
    bypassRls: false,
    rlsApplies: true,
  }),
}));

vi.mock("../runtime/config.js", () => ({
  loadServerConfig: () => ({ databaseUrl: "postgres://mock:5432/mms" }),
}));

vi.mock("../ddl-maintenance/facultyContactIndex.js", () => ({
  ensureFacultyContactIndex: ensureFacultyMock,
}));
vi.mock("../ddl-maintenance/enrollmentIntegrityIndexes.js", () => ({
  ensureEnrollmentIntegrityIndexes: ensureEnrollmentMock,
}));
vi.mock("../ddl-maintenance/attendanceAnalyticsIndexes.js", () => ({
  ensureAttendanceAnalyticsIndexes: ensureAttendanceMock,
}));
vi.mock("../ddl-maintenance/financeConcurrentIndexes.js", () => ({
  ensureFinanceConcurrentIndexes: ensureFinanceMock,
}));
vi.mock("../ddl-maintenance/contactSystemTagsPreMigration.js", () => ({
  prepareContactSystemTagsPreMigration: prepareContactTagsMock,
  CONTACT_TAG_PRE_MIGRATION_CLEANUP: {},
}));

import { applyDrizzleMigrations, resolveMigrationsFolder } from "../migrations.js";

describe("applyDrizzleMigrations", () => {
  beforeEach(() => {
    for (const mock of [
      pgClientQuery,
      pgClientConnect,
      pgClientEnd,
      migrateMock,
      ensureFacultyMock,
      ensureEnrollmentMock,
      ensureAttendanceMock,
      ensureFinanceMock,
      prepareContactTagsMock,
    ]) {
      mock.mockClear();
    }
  });

  it("resolves the packaged migrations folder", () => {
    const folder = resolveMigrationsFolder();
    expect(folder).toContain("migrations_drizzle");
  });

  it("executes migrations with RLS bypass, bounded lock timeout and all maintenance steps", async () => {
    const result = await applyDrizzleMigrations();

    expect(pgClientConnect).toHaveBeenCalledTimes(1);
    expect(pgClientQuery).toHaveBeenCalledWith("SELECT set_config('app.rls_bypass', 'on', false)");
    expect(pgClientQuery).toHaveBeenCalledWith("SET lock_timeout = '2s'");
    expect(prepareContactTagsMock).toHaveBeenCalledTimes(1);
    expect(migrateMock).toHaveBeenCalledTimes(1);
    expect(pgClientQuery).toHaveBeenCalledWith("SET lock_timeout = 0");
    expect(ensureFacultyMock).toHaveBeenCalledTimes(1);
    expect(ensureEnrollmentMock).toHaveBeenCalledTimes(1);
    expect(ensureAttendanceMock).toHaveBeenCalledTimes(1);
    expect(ensureFinanceMock).toHaveBeenCalledTimes(1);
    expect(result.migrationsFolder).toContain("migrations_drizzle");
  });
});
