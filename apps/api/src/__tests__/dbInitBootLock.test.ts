import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Boot wiring test.
 *
 * The Drizzle DDL pipeline itself lives in `@mms/db/migrations` and is covered by
 * `packages/db/src/__tests__/migrations.test.ts`; this suite owns the backend boot
 * behaviour (advisory lock, delegation, injected platform hooks).
 *
 * `db/dbInit.ts` no longer imports a single service: the app composition
 * (`bootstrap/initializeDatabase.ts`) injects `PlatformBootServices`. These tests
 * pin that seam — order, call-once, non-fatal partitions and explicit opt-out.
 */
const { clientQuery, releaseMock } = vi.hoisted(() => ({
  clientQuery: vi.fn().mockResolvedValue({ rows: [] }),
  releaseMock: vi.fn(),
}));

const { applyDrizzleMigrationsMock, resolveMigrationsFolderMock } = vi.hoisted(() => ({
  applyDrizzleMigrationsMock: vi.fn().mockResolvedValue({
    migrationsFolder: "/repo/packages/db/migrations_drizzle",
  }),
  resolveMigrationsFolderMock: vi.fn().mockReturnValue("/repo/packages/db/migrations_drizzle"),
}));

vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/client")>()),

  initializeDatabaseConnection: vi.fn(),
  assertRlsRuntimeRole: vi.fn().mockResolvedValue({
    role: "mocked",
    isSuperuser: false,
    bypassRls: false,
    rlsApplies: true,
  }),
  getPool: () => ({ connect: async () => ({ query: clientQuery, release: releaseMock }) }),
  getRootDb: () => ({ select: () => ({ from: async () => [{ count: 1 }] }) }),
  runInTransaction: async (cb: () => Promise<unknown>) => cb(),
  runInGlobalTransaction: async (cb: () => Promise<unknown>) => cb(),
}));

vi.mock("@mms/db/migrations", () => ({
  applyDrizzleMigrations: applyDrizzleMigrationsMock,
  resolveMigrationsFolder: resolveMigrationsFolderMock,
}));

vi.mock("../db/migrations/dataMigrationRegistry.js", () => ({ dataMigrationsToRun: [] }));

import {
  initDb,
  resetDbInitStateForTesting,
  resolveMigrationsFolder,
  applyDrizzleMigrations,
} from "../db/dbInit.js";
import { NO_PLATFORM_BOOT_SERVICES, type PlatformBootServices } from "../bootstrap/bootServices.js";

/** Recording stub bag; `order` proves the pipeline sequence. */
function createBootServices(order: string[] = []): PlatformBootServices {
  return {
    ensureAuditTrailPartitions: vi.fn(async () => void order.push("partitions")),
    purgeExpiredAuthArtifacts: vi.fn(async () => void order.push("purgeAuth")),
    ensurePlatformSuperUser: vi.fn(async () => void order.push("platformSuperUser")),
    syncPlatformSuperUserToTenants: vi.fn(async () => void order.push("syncSuperUser")),
    initPlatformSettings: vi.fn(async () => void order.push("settings")),
    initPlatformBranding: vi.fn(async () => void order.push("branding")),
  };
}

describe("dbInit suite", () => {
  const originalSkip = process.env.MMS_SKIP_BOOT_MIGRATIONS;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clientQuery.mockClear();
    releaseMock.mockClear();
    applyDrizzleMigrationsMock.mockClear();
    resolveMigrationsFolderMock.mockClear();
    resetDbInitStateForTesting();
  });

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.MMS_SKIP_BOOT_MIGRATIONS;
    else process.env.MMS_SKIP_BOOT_MIGRATIONS = originalSkip;
    process.env.NODE_ENV = originalEnv;
  });

  describe("resolveMigrationsFolder", () => {
    it("re-exports the @mms/db migrations-folder resolver", () => {
      const folder = resolveMigrationsFolder();
      expect(typeof folder).toBe("string");
      expect(folder).toContain("migrations_drizzle");
      expect(resolveMigrationsFolderMock).toHaveBeenCalled();
    });
  });

  describe("applyDrizzleMigrations", () => {
    it("delegates the DDL pipeline to @mms/db/migrations", async () => {
      const result = await applyDrizzleMigrations();
      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(1);
      expect(result.migrationsFolder).toContain("migrations_drizzle");
    });
  });

  describe("initDb boot lock", () => {
    it("acquires and releases the boot lock, and skips migrations when MMS_SKIP_BOOT_MIGRATIONS=true", async () => {
      process.env.MMS_SKIP_BOOT_MIGRATIONS = "true";

      await initDb({ force: true, services: createBootServices() });

      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_lock($1::integer)",
        [2145836403],
      );
      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_unlock($1::integer)",
        [2145836403],
      );
      expect(releaseMock).toHaveBeenCalledTimes(1);
      expect(applyDrizzleMigrationsMock).not.toHaveBeenCalled();
    });

    it("runs migrations when MMS_SKIP_BOOT_MIGRATIONS is not true", async () => {
      delete process.env.MMS_SKIP_BOOT_MIGRATIONS;

      await initDb({ force: true, services: createBootServices() });

      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_lock($1::integer)",
        [2145836403],
      );
      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_unlock($1::integer)",
        [2145836403],
      );
    });
  });

  describe("injected platform boot services", () => {
    it("calls every hook exactly once, in the documented order", async () => {
      const order: string[] = [];
      const services = createBootServices(order);

      await initDb({ force: true, services });

      expect(order).toEqual([
        "partitions",
        "purgeAuth",
        "platformSuperUser",
        "syncSuperUser",
        "settings",
        "branding",
      ]);
      for (const hook of Object.values(services)) {
        expect(hook).toHaveBeenCalledTimes(1);
      }
      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(1);
    });

    it("never blocks boot when partition provisioning fails", async () => {
      const order: string[] = [];
      const services = createBootServices(order);
      services.ensureAuditTrailPartitions = vi.fn(async () => {
        order.push("partitions");
        throw new Error("partition provisioning failed");
      });

      await expect(initDb({ force: true, services })).resolves.toBeUndefined();

      // The rest of the pipeline still ran.
      expect(order).toEqual([
        "partitions",
        "purgeAuth",
        "platformSuperUser",
        "syncSuperUser",
        "settings",
        "branding",
      ]);
    });

    it("skips the platform pipeline with the explicit opt-out, keeping DDL", async () => {
      delete process.env.MMS_SKIP_BOOT_MIGRATIONS;

      await expect(
        initDb({ force: true, services: NO_PLATFORM_BOOT_SERVICES }),
      ).resolves.toBeUndefined();

      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledWith(
        "select pg_advisory_unlock($1::integer)",
        [2145836403],
      );
    });

    it("re-runs the pipeline only when `force` is set", async () => {
      const first = createBootServices();
      await initDb({ services: first });
      await initDb({ services: createBootServices() });
      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(1);

      await initDb({ force: true, services: createBootServices() });
      expect(applyDrizzleMigrationsMock).toHaveBeenCalledTimes(2);
    });
  });
});
