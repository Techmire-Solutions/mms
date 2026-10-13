import { describe, expect, it, vi } from "vitest";
import { createUsersUseCases } from "../users/use-cases/usersUseCases.js";
import type { UsersRepository } from "../users/repository/usersRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

vi.mock("../services/auth/userService.js", () => ({
  getHydratedUsers: vi.fn().mockResolvedValue([]),
  saveUsers: vi.fn(),
}));
vi.mock("../services/auth/userServiceShared.js", () => ({
  getRawUsers: vi.fn().mockResolvedValue([]),
}));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../services/contactService.js", () => ({
  loadContactsByIds: vi.fn().mockResolvedValue([]),
}));

function createFakeRepo(): UsersRepository {
  return {
    listTenantUsersPage: vi
      .fn()
      .mockResolvedValue({ rows: [], total: 0, page: 1, limit: 50, hasMore: false }),
    countTenantUsersActive: vi.fn().mockResolvedValue(3),
    aggregateUsersCommandMetrics: vi.fn().mockResolvedValue({
      total: 3,
      active: 2,
      suspended: 0,
      admins: 1,
      twoFaEnabled: 1,
      activeSessions: 2,
    }),
    listTenantUsersByIds: vi.fn().mockResolvedValue([]),
    findTenantUserRowById: vi.fn().mockResolvedValue(null),
    softDeleteTenantUserRow: vi.fn().mockResolvedValue(true),
    restoreTenantUserRow: vi.fn().mockResolvedValue(true),
    verifyTenantUserEmailRow: vi.fn().mockResolvedValue(true),
    resetTenantUserPasswordRow: vi.fn().mockResolvedValue(true),
    listActivityLogsByWorkspace: vi.fn().mockResolvedValue([]),
    findActivityLogById: vi.fn().mockResolvedValue(null),
    findActivityLogsByIds: vi.fn().mockResolvedValue([]),
    saveActivityLog: vi.fn().mockResolvedValue(undefined),
    bulkSaveActivityLogs: vi.fn().mockResolvedValue(undefined),
    replaceActivityLogsForWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

describe("users use-cases (DI with fake repository)", () => {
  it("countUsers delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.countUsers());

    expect(result).toBe(3);
    expect(repo.countTenantUsersActive).toHaveBeenCalledWith("demo");
  });

  it("loadUsersCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadUsersCommandMetrics());

    expect(result.total).toBe(3);
    expect(repo.aggregateUsersCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("loadUserById returns null on invalid ID or missing user", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);

    expect(await runWithTenant("demo", () => useCases.loadUserById(""))).toBeNull();
    expect(await runWithTenant("demo", () => useCases.loadUserById("   "))).toBeNull();
    expect(await runWithTenant("demo", () => useCases.loadUserById("usr_missing"))).toBeNull();
    expect(repo.listTenantUsersByIds).toHaveBeenCalledWith("demo", ["usr_missing"]);
  });

  it("loadUserById filters soft-deleted user unless includeDeleted is true", async () => {
    const repo = createFakeRepo();
    const fakeRow = {
      id: "usr_1",
      workspaceSubdomain: "demo",
      loginEmail: "user@example.com",
      email: "user@example.com",
      passwordHash: "hash",
      name: "Test User",
      role: "staff",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
      deletedAt: "2026-02-01T00:00:00.000Z",
      deletedBy: "admin",
    };
    (repo.listTenantUsersByIds as ReturnType<typeof vi.fn>).mockResolvedValue([fakeRow]);
    const useCases = createUsersUseCases(repo);

    const activeOnly = await runWithTenant("demo", () => useCases.loadUserById("usr_1"));
    expect(activeOnly).toBeNull();

    const withDeleted = await runWithTenant("demo", () => useCases.loadUserById("usr_1", true));
    expect(withDeleted).not.toBeNull();
    expect(withDeleted?.id).toBe("usr_1");
  });

  it("loadUsersByIds dedupes trimmed IDs and filters soft-deleted", async () => {
    const repo = createFakeRepo();
    const rowActive = {
      id: "usr_1",
      workspaceSubdomain: "demo",
      loginEmail: "user1@example.com",
      email: "user1@example.com",
      passwordHash: "hash",
      name: "User One",
      role: "staff",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
      deletedAt: null,
      deletedBy: null,
    };
    const rowDeleted = {
      id: "usr_2",
      workspaceSubdomain: "demo",
      loginEmail: "user2@example.com",
      email: "user2@example.com",
      passwordHash: "hash",
      name: "User Two",
      role: "staff",
      createdAt: "2026-01-01T00:00:00.000Z",
      mustChangePassword: false,
      deletedAt: "2026-02-01T00:00:00.000Z",
      deletedBy: "admin",
    };
    (repo.listTenantUsersByIds as ReturnType<typeof vi.fn>).mockResolvedValue([
      rowActive,
      rowDeleted,
    ]);
    const useCases = createUsersUseCases(repo);

    const empty = await runWithTenant("demo", () => useCases.loadUsersByIds([" ", ""]));
    expect(empty).toEqual([]);
    expect(repo.listTenantUsersByIds).not.toHaveBeenCalled();

    const activeList = await runWithTenant("demo", () =>
      useCases.loadUsersByIds(["usr_1 ", "usr_2", "usr_1"]),
    );
    expect(repo.listTenantUsersByIds).toHaveBeenCalledWith("demo", ["usr_1", "usr_2"]);
    expect(activeList).toHaveLength(1);
    expect(activeList[0]?.id).toBe("usr_1");

    const allList = await runWithTenant("demo", () =>
      useCases.loadUsersByIds(["usr_1", "usr_2"], true),
    );
    expect(allList).toHaveLength(2);
  });

  it("loadLogById and loadLogsByIds respect tenant scoping and ID cleaning", async () => {
    const repo = createFakeRepo();
    const fakeLog = {
      id: "log-1",
      userId: "u-1",
      action: "create" as const,
      module: "users",
      detail: "Created user",
      ts: "2026-01-01T00:00:00.000Z",
      ip: "127.0.0.1",
    };
    (repo.findActivityLogById as ReturnType<typeof vi.fn>).mockResolvedValue(fakeLog);
    (repo.findActivityLogsByIds as ReturnType<typeof vi.fn>).mockResolvedValue([fakeLog]);
    const useCases = createUsersUseCases(repo);

    expect(await useCases.loadLogById("log-1")).toBeNull();
    expect(await useCases.loadLogsByIds(["log-1"])).toEqual([]);

    const single = await runWithTenant("demo", () => useCases.loadLogById(" log-1 "));
    expect(single).toEqual(fakeLog);
    expect(repo.findActivityLogById).toHaveBeenCalledWith("demo", "log-1");

    const multi = await runWithTenant("demo", () =>
      useCases.loadLogsByIds([" log-1 ", "log-1", " "]),
    );
    expect(multi).toEqual([fakeLog]);
    expect(repo.findActivityLogsByIds).toHaveBeenCalledWith("demo", ["log-1"]);
  });

  it("saveLog validates log, saves to repository, and broadcasts", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);
    const log = {
      id: "log-1",
      userId: "u-1",
      action: "create" as const,
      module: "users",
      detail: "Created user",
      ts: "2026-01-01T00:00:00.000Z",
      ip: "127.0.0.1",
    };

    await useCases.saveLog(log);
    expect(repo.saveActivityLog).not.toHaveBeenCalled();

    await runWithTenant("demo", () => useCases.saveLog(log));
    expect(repo.saveActivityLog).toHaveBeenCalledWith("demo", log);
  });

  it("upsertLogs delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);
    const log = {
      id: "log-1",
      userId: "u-1",
      action: "create" as const,
      module: "users",
      detail: "Created user",
      ts: "2026-01-01T00:00:00.000Z",
      ip: "127.0.0.1",
    };

    const result = await runWithTenant("demo", () => useCases.upsertLogs([log]));

    expect(result).toEqual([log]);
    expect(repo.bulkSaveActivityLogs).toHaveBeenCalledWith("demo", [log]);
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createUsersUseCases(repo);

    const count = await useCases.countUsers();
    const metrics = await useCases.loadUsersCommandMetrics();

    expect(count).toBe(0);
    expect(metrics.total).toBe(0);
    expect(repo.countTenantUsersActive).not.toHaveBeenCalled();
    expect(repo.aggregateUsersCommandMetrics).not.toHaveBeenCalled();
  });
});
