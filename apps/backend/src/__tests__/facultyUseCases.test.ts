import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Faculty, FacultyListQuery } from "@mms/shared";
import type { FacultyRepository } from "../faculty/repository/facultyRepository.js";

const mockGetRequestTenant = vi.fn();
const mockBroadcastCollection = vi.fn();
const mockLoadFacultyFieldConfig = vi.fn();
const mockLoadFacultyModulePreferences = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant() ?? "demo",
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../faculty/use-cases/facultyHydrateUseCases.js", () => ({
  hydrateFacultyFromContacts: async (_tenant: unknown, rows: unknown) => rows,
}));

vi.mock("../faculty/use-cases/facultyConfigService.js", () => ({
  loadFacultyFieldConfig: (...args: unknown[]) => mockLoadFacultyFieldConfig(...args),
}));

vi.mock("../faculty/use-cases/facultyPreferencesService.js", () => ({
  loadFacultyModulePreferences: (...args: unknown[]) => mockLoadFacultyModulePreferences(...args),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

// Link guards are DB-backed (contacts / designations); the DI composition root is under test here.
vi.mock("../faculty/use-cases/facultyWriteGuards.js", () => ({
  validateFacultyContactLink: vi.fn().mockResolvedValue({ userId: null }),
  validateFacultyDesignationLink: vi.fn().mockResolvedValue({ departmentId: "" }),
}));

vi.mock("../db/repositories/facultyAssignmentCascade.js", () => ({
  cascadeSoftDeleteFacultyAssignments: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyAssignments: vi.fn().mockResolvedValue(0),
}));

vi.mock("../db/repositories/facultyEmploymentRepository.js", () => ({
  cascadeSoftDeleteFacultyEmployments: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyEmployments: vi.fn().mockResolvedValue(0),
  upsertFacultyEmploymentTx: vi.fn().mockResolvedValue(undefined),
  flattenFacultyEmploymentFields: (member: unknown) => member,
}));

vi.mock("../db/repositories/facultyEmployDesignationRepository.js", () => ({
  cascadeSoftDeleteFacultyEmployDesignations: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyEmployDesignations: vi.fn().mockResolvedValue(0),
  upsertFacultyEmployDesignationTx: vi.fn().mockResolvedValue("faced-mock"),
}));

import { createFacultyUseCases } from "../faculty/use-cases/facultyUseCases.js";

function fakeFaculty(id: string, overrides: Partial<Faculty> = {}): Faculty {
  return {
    id,
    contactId: `c-${id}`,
    name: `Faculty ${id}`,
    status: "active",
    designationId: "des-1",
    ...overrides,
  };
}

/** In-memory fake repository — the DI seam the use cases are designed against. */
function createFakeRepo() {
  const store = new Map<string, Faculty>();
  return {
    store,
    repo: {
      countByWorkspace: vi.fn(async (tenant: string, options?: { includeDeleted?: boolean }) => {
        void tenant;
        return [...store.values()].filter((s) =>
          options?.includeDeleted ? true : s.deletedAt === undefined,
        ).length;
      }),
      listPage: vi.fn(async (tenant: string, query: FacultyListQuery) => {
        void tenant;
        const rows = query.includeDeleted
          ? [...store.values()].filter((s) => s.deletedAt !== undefined)
          : [...store.values()].filter((s) => s.deletedAt === undefined);
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const start = (page - 1) * limit;
        return {
          faculty: rows.slice(start, start + limit),
          total: rows.length,
          page,
          limit,
          hasMore: start + limit < rows.length,
        };
      }),
      findById: vi.fn(async (tenant: string, id: string) => {
        void tenant;
        return store.get(id) ?? null;
      }),
      findByIds: vi.fn(async (tenant: string, ids: string[]) => {
        void tenant;
        return ids.map((id) => store.get(id)).filter((s): s is Faculty => Boolean(s));
      }),
      findSoftDeletedByContactId: vi.fn(async () => null),
      save: vi.fn(async (tenant: string, faculty: Faculty) => {
        void tenant;
        store.set(String(faculty.id), faculty);
      }),
      bulkSave: vi.fn(async (tenant: string, facultyList: Faculty[]) => {
        void tenant;
        facultyList.forEach((f) => store.set(String(f.id), f));
      }),
      aggregateCommandMetrics: vi.fn(async () => ({
        total: 0,
        active: 0,
        inactive: 0,
        onLeave: 0,
        other: 0,
        newThisPeriod: 0,
      })),
      aggregateWidgetQueries: vi.fn(async () => ({})),
      listLinkedContactIds: vi.fn(async () => []),
      countNextEmployeeId: vi.fn(async () => 0),
      listActiveMissingEmployeeId: vi.fn(async () => []),
      findRegistrationConflict: vi.fn(async () => null),
      bulkUpdateStatusSql: vi.fn(async () => 0),
      guardAssignmentDependents: vi.fn().mockResolvedValue(undefined),
      countSubordinates: vi.fn(async (_tenant: string, id: string) => {
        return [...store.values()].filter(
          (s) => (s as { reportingFacultyId?: string }).reportingFacultyId === id && !s.deletedAt,
        ).length;
      }),
      countSubordinatesBatch: vi.fn(async (_tenant: string, ids: string[]) => {
        const counts = new Map<string, number>();
        ids.forEach((id) => counts.set(id, 0));
        [...store.values()].forEach((s) => {
          const sup = (s as { reportingFacultyId?: string }).reportingFacultyId;
          if (sup && counts.has(sup) && !s.deletedAt) {
            counts.set(sup, (counts.get(sup) ?? 0) + 1);
          }
        });
        return counts;
      }),
      findSubordinates: vi.fn(async (_tenant: string, id: string) => {
        return [...store.values()].filter(
          (s) => (s as { reportingFacultyId?: string }).reportingFacultyId === id && !s.deletedAt,
        );
      }),
      reassignSubordinates: vi.fn(
        async (_tenant: string, oldSupervisorId: string, newSupervisorId: string | null) => {
          let count = 0;
          [...store.values()].forEach((s) => {
            if (
              (s as { reportingFacultyId?: string }).reportingFacultyId === oldSupervisorId &&
              !s.deletedAt
            ) {
              (s as { reportingFacultyId?: string | null }).reportingFacultyId = newSupervisorId;
              count++;
            }
          });
          return count;
        },
      ),
    } as unknown as FacultyRepository,
  };
}

describe("createFacultyUseCases (DI composition root)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockBroadcastCollection.mockResolvedValue(undefined);
    mockLoadFacultyFieldConfig.mockResolvedValue(null);
    mockLoadFacultyModulePreferences.mockResolvedValue({});
  });

  it("loadFacultyPage returns paged rows from the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("b", fakeFaculty("b"));
    store.set("c", fakeFaculty("c"));
    const useCases = createFacultyUseCases(repo);

    const page = await useCases.loadFacultyPage({ page: 2, limit: 2 });
    expect(page.faculty.map((t) => t.id)).toEqual(["c"]);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it("createFaculty saves a normalized record through the injected repo and broadcasts once", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    const { record, restored } = await useCases.createFaculty({
      contactId: "c-new",
      status: "active",
      designationId: "des-1",
      specialization: "Qaidah",
    });

    expect(restored).toBe(false);
    expect(typeof record.id).toBe("string");
    expect(String(record.id).length).toBeGreaterThan(0);
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ specialization: "Qaidah" }),
      { createOnly: true },
    );
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("createFaculty strips contact-owned profile keys (Contacts SSOT)", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    const { record } = await useCases.createFaculty({
      contactId: "c-new",
      status: "active",
      designationId: "des-1",
      name: "Should Strip",
      phone: "+923001234567",
      email: "a@b.com",
      gender: "male",
      dob: "2000-01-01",
    } as never);

    expect(record).not.toHaveProperty("name");
    expect(record).not.toHaveProperty("phone");
    expect(record).not.toHaveProperty("email");
    expect(record).not.toHaveProperty("gender");
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.not.objectContaining({ name: "Should Strip" }),
      { createOnly: true },
    );
  });

  it("createFaculty restores an archived row with the same contactId and preserves its id", async () => {
    const { repo, store } = createFakeRepo();
    const archived = fakeFaculty("archived", {
      deletedAt: "2026-07-27T00:00:00.000Z",
      deletedBy: "u-admin",
      specialization: "Hifz",
    });
    store.set("archived", archived);
    vi.mocked(repo.findSoftDeletedByContactId).mockResolvedValue(archived);
    const useCases = createFacultyUseCases(repo);

    const { record, restored } = await useCases.createFaculty({
      contactId: "c-archived",
      status: "active",
      designationId: "des-1",
      specialization: "Tajweed",
    });

    expect(restored).toBe(true);
    expect(record.id).toBe("archived");
    expect(record.specialization).toBe("Tajweed");
    expect(record.deletedAt).toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "archived" }));
  });

  it("updateFacultyById returns null for a missing or soft-deleted id", async () => {
    const { repo, store } = createFakeRepo();
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    expect(
      await useCases.updateFacultyById("missing", { id: "missing", contactId: "c-x" }),
    ).toBeNull();
    expect(
      await useCases.updateFacultyById("gone", { id: "gone", contactId: "c-gone" }),
    ).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateFacultyById saves the merged record for an active row", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    const useCases = createFacultyUseCases(repo);

    const updated = await useCases.updateFacultyById("a", {
      id: "a",
      contactId: "c-a",
      qualification: "MA",
    });

    expect(updated?.id).toBe("a");
    expect(updated?.deletedAt).toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "a", qualification: "MA" }),
    );
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("updateFacultyById preserves existing fields when patch omits them", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeFaculty("a", {
        specialization: "Tajweed",
        qualification: "MA",
        employeeId: "EMP-01",
      }),
    );
    const useCases = createFacultyUseCases(repo);

    const updated = await useCases.updateFacultyById("a", {
      id: "a",
      contactId: undefined,
      status: "on_leave",
    });

    expect(updated?.status).toBe("on_leave");
    expect(updated?.specialization).toBe("Tajweed");
    expect(updated?.qualification).toBe("MA");
    expect(updated?.employeeId).toBe("EMP-01");
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "a",
        status: "on_leave",
        specialization: "Tajweed",
        qualification: "MA",
        employeeId: "EMP-01",
      }),
    );
  });

  it("softDeleteFacultyById marks only active rows and records who deleted them", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    expect(await useCases.softDeleteFacultyById("a", "u-admin", "Left faculty")).toBe(true);
    expect(await useCases.softDeleteFacultyById("gone", "u-admin")).toBe(false);

    const saved = store.get("a");
    expect(saved?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved?.deletedBy).toBe("u-admin");
    expect(saved?.deletionReason).toBe("Left faculty");
  });

  it("bulkSoftDeleteFaculty splits succeeded/failed rows and broadcasts once", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.bulkSoftDeleteFaculty(
      ["a", "gone"],
      "u-admin",
      "  Left faculty  ",
    );

    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(store.get("a")?.deletedBy).toBe("u-admin");
    expect(store.get("a")?.deletionReason).toBe("Left faculty");
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("restoreFacultyById clears soft-delete fields and bumps updatedAt", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeFaculty("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    const useCases = createFacultyUseCases(repo);

    const restored = await useCases.restoreFacultyById("a");

    expect(restored?.deletedAt).toBeUndefined();
    expect(restored?.deletedBy).toBeUndefined();
    expect(restored?.deletionReason).toBeUndefined();
    expect(restored?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get("a")?.deletedAt).toBeUndefined();
    expect(store.get("a")?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("restoreFacultyById returns an active record unchanged without saving", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    const useCases = createFacultyUseCases(repo);

    const restored = await useCases.restoreFacultyById("a");

    expect(restored?.id).toBe("a");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("bulkRestoreFaculty restores deleted rows and reports active rows as failed", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeFaculty("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    store.set("active", fakeFaculty("active"));
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.bulkRestoreFaculty(["a", "active"]);

    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(store.get("a")?.deletedAt).toBeUndefined();
    expect(store.get("a")?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("bulkRestoreFaculty deduplicates input IDs and handles whitespace", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.bulkRestoreFaculty(["a", " a ", "a"]);

    expect(result).toEqual({ succeeded: 1, failed: 0 });
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
  });

  it("countFaculty counts only active rows via the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("b", fakeFaculty("b"));
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    expect(await useCases.countFaculty()).toBe(2);
    expect(repo.countByWorkspace).toHaveBeenCalledWith("demo", { includeDeleted: undefined });
  });

  it("countFaculty includes deleted rows when includeDeleted is set", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    expect(await useCases.countFaculty({ includeDeleted: true })).toBe(2);
    expect(repo.countByWorkspace).toHaveBeenCalledWith("demo", { includeDeleted: true });
  });

  it("loadFacultyById hides deleted rows unless includeDeleted is set", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    expect(await useCases.loadFacultyById("a")).toBeNull();
    expect((await useCases.loadFacultyById("a", true))?.id).toBe("a");
  });

  it("loadFacultyCommandMetrics delegates to the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.aggregateCommandMetrics).mockResolvedValue({
      total: 5,
      active: 3,
      inactive: 1,
      onLeave: 1,
      other: 0,
      newThisPeriod: 2,
    });
    const useCases = createFacultyUseCases(repo);

    const metrics = await useCases.loadFacultyCommandMetrics();

    expect(metrics.total).toBe(5);
    expect(repo.aggregateCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("loadFacultyWidgetAggregates passes queries to the injected repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    await useCases.loadFacultyWidgetAggregates([{ id: "w1", operation: "count" }]);

    expect(repo.aggregateWidgetQueries).toHaveBeenCalledWith("demo", [
      { id: "w1", operation: "count" },
    ]);
  });

  it("bulkUpdateFacultyStatus delegates to the SQL bulk update and broadcasts", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.bulkUpdateStatusSql).mockResolvedValue(2);
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.bulkUpdateFacultyStatus(["t-1", "t-2"], "inactive");

    expect(result).toEqual({ succeeded: 2, failed: 0 });
    expect(repo.bulkUpdateStatusSql).toHaveBeenCalledWith("demo", ["t-1", "t-2"], "inactive");
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("computeNextFacultyEmployeeIdForSettings formats the next employee id from the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.countNextEmployeeId).mockResolvedValue(5);
    const useCases = createFacultyUseCases(repo);

    const employeeId = await useCases.computeNextFacultyEmployeeIdForSettings({
      idPrefix: "T",
      idTemplate: "{PREFIX}-{SEQ}",
    });

    expect(employeeId).toBe("T-0006");
    expect(repo.countNextEmployeeId).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ prefix: "T" }),
    );
  });

  it("computeNextFacultyEmployeeIdForSettings supports dynamic templates and skips collisions", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.countNextEmployeeId).mockResolvedValue(10);
    vi.mocked(repo.findRegistrationConflict).mockImplementation(async (_tenant, input) => {
      if (input.employeeId === "EMP-0011") return "employeeId";
      return null;
    });
    const useCases = createFacultyUseCases(repo);

    const employeeId = await useCases.computeNextFacultyEmployeeIdForSettings({
      idPrefix: "EMP",
      idTemplate: "{PREFIX}-{SEQ}",
    });

    expect(employeeId).toBe("EMP-0012");
  });

  it("loadFacultyByIds returns matched rows from the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("b", fakeFaculty("b"));
    const useCases = createFacultyUseCases(repo);

    const rows = await useCases.loadFacultyByIds(["a", "missing", "b"]);

    expect(rows.map((t) => t.id)).toEqual(["a", "b"]);
    expect(repo.findByIds).toHaveBeenCalledWith("demo", ["a", "missing", "b"]);
  });

  it("loadFacultyByIds filters out soft-deleted faculty", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeFaculty("a"));
    store.set("gone", fakeFaculty("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createFacultyUseCases(repo);

    const rows = await useCases.loadFacultyByIds(["a", "gone"]);

    expect(rows.map((t) => t.id)).toEqual(["a"]);
  });

  it("loadFacultyByIds returns an empty array for empty input without hitting the repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    expect(await useCases.loadFacultyByIds([])).toEqual([]);
    expect(repo.findByIds).not.toHaveBeenCalled();
  });

  it("loadFacultyLinkedContactIds delegates to the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.listLinkedContactIds).mockResolvedValue(["c-1", "c-2"]);
    const useCases = createFacultyUseCases(repo);

    const ids = await useCases.loadFacultyLinkedContactIds("t-exclude");

    expect(ids).toEqual(["c-1", "c-2"]);
    expect(repo.listLinkedContactIds).toHaveBeenCalledWith("demo", "t-exclude");
  });

  it("checkFacultyRegistrationDuplicate returns the conflict reason from the repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.findRegistrationConflict).mockResolvedValue("employeeId");
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.checkFacultyRegistrationDuplicate({ employeeId: "T-0001" });

    expect(result).toEqual({ reason: "employeeId" });
    expect(repo.findRegistrationConflict).toHaveBeenCalledWith("demo", { employeeId: "T-0001" });
  });

  it("checkFacultyRegistrationDuplicate returns no conflict when the repo finds none", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.checkFacultyRegistrationDuplicate({ contactId: "c-new" });

    expect(result).toEqual({ reason: null });
    expect(repo.findRegistrationConflict).toHaveBeenCalledWith("demo", { contactId: "c-new" });
  });

  it("migrateFacultyMissingEmployeeIds backfills monotonic employee ids and broadcasts once", async () => {
    const { repo, store } = createFakeRepo();
    store.set("m1", fakeFaculty("m1"));
    store.set("m2", fakeFaculty("m2"));
    vi.mocked(repo.listActiveMissingEmployeeId).mockResolvedValue([
      fakeFaculty("m1"),
      fakeFaculty("m2"),
    ]);
    const countNextEmployeeIdMock = vi.mocked(repo.countNextEmployeeId);
    countNextEmployeeIdMock.mockImplementation(async () => {
      // countNextEmployeeId is called once per persisted row; return a growing count.
      return countNextEmployeeIdMock.mock.calls.length - 1;
    });
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.migrateFacultyMissingEmployeeIds();

    expect(result).toEqual({ updated: 2 });
    expect(typeof store.get("m1")?.employeeId).toBe("string");
    expect(typeof store.get("m2")?.employeeId).toBe("string");
    expect(store.get("m2")?.employeeId).not.toBe(store.get("m1")?.employeeId);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
  });

  it("migrateFacultyMissingEmployeeIds is a no-op when no rows are missing", async () => {
    const { repo } = createFakeRepo();
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.migrateFacultyMissingEmployeeIds();

    expect(result).toEqual({ updated: 0 });
    expect(repo.countNextEmployeeId).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).not.toHaveBeenCalled();
  });

  it("migrateFacultyMissingEmployeeIds returns early without a tenant", async () => {
    const { repo } = createFakeRepo();
    mockGetRequestTenant.mockReturnValue(null);
    const useCases = createFacultyUseCases(repo);

    const result = await useCases.migrateFacultyMissingEmployeeIds();

    expect(result).toEqual({ updated: 0 });
    expect(repo.listActiveMissingEmployeeId).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).not.toHaveBeenCalled();
  });

  it("sanitizeFacultyForViewer passes the record through when no field config is registered", async () => {
    const { repo } = createFakeRepo();
    mockLoadFacultyFieldConfig.mockResolvedValue(null);
    const useCases = createFacultyUseCases(repo);

    const faculty = fakeFaculty("a", { phone: "+923001234567" });
    expect(await useCases.sanitizeFacultyForViewer(faculty, "faculty")).toEqual(faculty);
  });

  it("sanitizeFacultyForViewer hides disabled fields per the field config", async () => {
    const { repo } = createFakeRepo();
    mockLoadFacultyFieldConfig.mockResolvedValue({
      fields: {
        employment: [
          { key: "qualification", label: "Qualification", type: "text", enabled: false, order: 0 },
          { key: "specialization", label: "Specialization", type: "text", enabled: true, order: 1 },
        ],
      },
      formTabs: [{ key: "employment", label: "Employment", enabled: true, order: 0 }],
    });
    const useCases = createFacultyUseCases(repo);

    const faculty = fakeFaculty("a", { qualification: "MA", specialization: "Qaidah" });
    const sanitized = await useCases.sanitizeFacultyForViewer(faculty, "faculty");

    expect(sanitized.qualification).toBeUndefined();
    expect(sanitized.specialization).toBe("Qaidah");
  });

  it("sanitizeFacultyListForViewer strips disabled fields from every row", async () => {
    const { repo } = createFakeRepo();
    mockLoadFacultyFieldConfig.mockResolvedValue({
      fields: {
        employment: [
          { key: "qualification", label: "Qualification", type: "text", enabled: false, order: 0 },
        ],
      },
      formTabs: [{ key: "employment", label: "Employment", enabled: true, order: 0 }],
    });
    const useCases = createFacultyUseCases(repo);

    const rows = [
      fakeFaculty("a", { qualification: "MA" }),
      fakeFaculty("b", { qualification: "BA" }),
    ];
    const sanitized = await useCases.sanitizeFacultyListForViewer(rows, "faculty");

    expect(sanitized.every((t) => t.qualification === undefined)).toBe(true);
  });
});
