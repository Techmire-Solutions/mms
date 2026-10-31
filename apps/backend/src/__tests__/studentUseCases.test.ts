import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student, StudentsListQuery } from "@mms/shared";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";

const mockGetRequestTenant = vi.fn();
const mockBroadcastCollection = vi.fn();
const mockLoadStudentFieldConfig = vi.fn();
const mockLoadStudentModulePreferences = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant() ?? "test-subdomain",
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({
    execute: async () => undefined,
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  hasActiveTransaction: () => true,
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/softDeleteHelpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/softDeleteHelpers.js")>();
  return {
    ...actual,
    enableIncludeDeleted: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "a".repeat(64),
    canonicalPayload: "{}",
  }),
  sanitizeAuditState: (v: unknown) => v,
}));

vi.mock("../students/use-cases/studentHydrateUseCases.js", () => ({
  hydrateStudentsFromContacts: async (_tenant: unknown, rows: unknown) => rows,
}));

vi.mock("../students/use-cases/studentConfigService.js", () => ({
  loadStudentFieldConfig: (...args: unknown[]) => mockLoadStudentFieldConfig(...args),
}));

vi.mock("../students/use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: (...args: unknown[]) => mockLoadStudentModulePreferences(...args),
}));

import { createStudentsUseCases } from "../students/use-cases/studentUseCases.js";
import { StudentRestoreConflictError } from "../students/use-cases/studentNormalizeUseCases.js";

function fakeStudent(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    contactId: `c-${id}`,
    name: `Student ${id}`,
    status: "active",
    ...overrides,
  };
}

/** In-memory fake repository — the DI seam the use cases are designed against. */
function createFakeRepo() {
  const store = new Map<string, Student>();
  return {
    store,
    repo: {
      countByWorkspace: vi.fn(async (tenant: string) => {
        void tenant;
        return [...store.values()].filter((s) => s.deletedAt === undefined).length;
      }),
      listPage: vi.fn(async (tenant: string, query: StudentsListQuery) => {
        void tenant;
        const rows = query.includeDeleted
          ? [...store.values()].filter((s) => s.deletedAt !== undefined)
          : [...store.values()].filter((s) => s.deletedAt === undefined);
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const start = (page - 1) * limit;
        return {
          students: rows.slice(start, start + limit),
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
        return ids.map((id) => store.get(id)).filter((s): s is Student => Boolean(s));
      }),
      save: vi.fn(async (tenant: string, student: Student) => {
        void tenant;
        store.set(String(student.id), student);
      }),
      bulkSave: vi.fn(async (tenant: string, students: Student[]) => {
        void tenant;
        students.forEach((student) => store.set(String(student.id), student));
      }),
      aggregateCommandMetrics: vi.fn(async () => ({
        total: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        newThisPeriod: 0,
      })),
      aggregateWidgetQueries: vi.fn(async () => ({})),
      listLinkedContactIds: vi.fn(async () => []),
      countNextGrNumber: vi.fn(async () => 0),
      findRegistrationConflict: vi.fn(async () => null),
      findActiveGrNumberOwners: vi.fn(async () => new Map()),
      findActiveStudentIdOwners: vi.fn(async () => new Map()),
      findSoftDeletedByContactId: vi.fn(async () => null),
      listActiveMissingGrNumber: vi.fn(async () => []),
      bulkUpdateStatusSql: vi.fn(async () => 0),
    } as unknown as StudentsRepository,
  };
}

describe("createStudentsUseCases (DI composition root)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockBroadcastCollection.mockResolvedValue(undefined);
    mockLoadStudentFieldConfig.mockResolvedValue(null);
    mockLoadStudentModulePreferences.mockResolvedValue({});
  });

  it("loadStudentsPage returns paged rows from the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    store.set("b", fakeStudent("b"));
    store.set("c", fakeStudent("c"));
    const useCases = createStudentsUseCases(repo);

    const page = await useCases.loadStudentsPage({ page: 2, limit: 2 });
    expect(page.students.map((s) => s.id)).toEqual(["c"]);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it("createStudent saves a normalized record through the injected repo and broadcasts once", async () => {
    const { repo } = createFakeRepo();
    const useCases = createStudentsUseCases(repo);

    const { record, restored } = await useCases.createStudent({
      contactId: "c-new",
      status: "active",
      grNumber: "GR-1",
      fatherContactId: undefined,
      motherContactId: undefined,
      guardianContactId: undefined,
    });

    expect(restored).toBe(false);
    expect(typeof record.id).toBe("string");
    expect(String(record.id).length).toBeGreaterThan(0);
    expect(repo.save).toHaveBeenCalledWith("demo", expect.objectContaining({ grNumber: "gr-1" }));
    expect(mockBroadcastCollection).toHaveBeenCalledTimes(1);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("students");
  });

  it("createStudent restores an archived row with the same contactId and preserves its id", async () => {
    const { repo, store } = createFakeRepo();
    const archived = fakeStudent("archived", {
      deletedAt: "2026-07-27T00:00:00.000Z",
      deletedBy: "u-admin",
      grNumber: "GR-OLD",
    });
    store.set("archived", archived);
    vi.mocked(repo.findSoftDeletedByContactId).mockResolvedValue(archived);
    const useCases = createStudentsUseCases(repo);

    const { record, restored } = await useCases.createStudent(
      {
        contactId: "c-archived",
        status: "active",
        grNumber: "GR-NEW",
        fatherContactId: undefined,
        motherContactId: undefined,
        guardianContactId: undefined,
      },
      { role: "admin", id: "u-admin" } as any,
    );

    expect(restored).toBe(true);
    expect(record.id).toBe("archived");
    expect(record.grNumber).toBe("gr-new");
    expect(record.deletedAt).toBeUndefined();
    expect(repo.findRegistrationConflict).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ grNumber: "gr-new", excludeId: "archived" }),
    );
    expect(repo.save).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "archived" }));
  });

  it("createStudent rejects with StudentRestoreConflictError when the restored GR collides", async () => {
    const { repo, store } = createFakeRepo();
    const archived = fakeStudent("archived", {
      deletedAt: "2026-07-27T00:00:00.000Z",
      grNumber: "GR-1",
    });
    store.set("archived", archived);
    vi.mocked(repo.findSoftDeletedByContactId).mockResolvedValue(archived);
    vi.mocked(repo.findRegistrationConflict).mockResolvedValue("grNumber");
    const useCases = createStudentsUseCases(repo);

    await expect(
      useCases.createStudent(
        {
          contactId: "c-archived",
          status: "active",
          grNumber: "GR-1",
          fatherContactId: undefined,
          motherContactId: undefined,
          guardianContactId: undefined,
        },
        { role: "admin", id: "u-admin" } as any,
      ),
    ).rejects.toBeInstanceOf(StudentRestoreConflictError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateStudentById returns null for a missing or soft-deleted id", async () => {
    const { repo, store } = createFakeRepo();
    store.set("gone", fakeStudent("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createStudentsUseCases(repo);

    const missingRecord = {
      id: "missing",
      contactId: "c-x",
      fatherContactId: undefined,
      motherContactId: undefined,
      guardianContactId: undefined,
    };
    const goneRecord = { ...missingRecord, id: "gone" };
    expect(await useCases.updateStudentById("missing", missingRecord)).toBeNull();
    expect(await useCases.updateStudentById("gone", goneRecord)).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateStudentById saves the merged record for an active row", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    const useCases = createStudentsUseCases(repo);

    const updated = await useCases.updateStudentById("a", {
      id: "a",
      contactId: "c-a",
      grNumber: "GR-99",
      fatherContactId: undefined,
      motherContactId: undefined,
      guardianContactId: undefined,
    });

    expect(updated?.id).toBe("a");
    expect(updated?.deletedAt).toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "a", grNumber: "gr-99" }),
    );
    expect(mockBroadcastCollection).toHaveBeenCalledWith("students");
  });

  it("softDeleteStudentById marks only active rows and records who deleted them", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    store.set("gone", fakeStudent("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createStudentsUseCases(repo);

    expect(await useCases.softDeleteStudentById("a", "u-admin", "Duplicate")).toBe(true);
    expect(await useCases.softDeleteStudentById("gone", "u-admin")).toBe(false);

    const saved = store.get("a");
    expect(saved?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved?.deletedBy).toBe("u-admin");
    expect(saved?.deletionReason).toBe("Duplicate");
  });

  it("bulkSoftDeleteStudents splits succeeded/failed rows and broadcasts once", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    store.set("gone", fakeStudent("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkSoftDeleteStudents(["a", "gone"], "u-admin", "  Duplicate  ");

    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(store.get("a")?.deletedBy).toBe("u-admin");
    expect(store.get("a")?.deletionReason).toBe("Duplicate");
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledTimes(1);
  });

  it("restoreStudentById clears soft-delete fields on the stored record", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeStudent("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    const useCases = createStudentsUseCases(repo);

    const restored = await useCases.restoreStudentById("a");

    expect(restored?.deletedAt).toBeUndefined();
    expect(restored?.deletedBy).toBeUndefined();
    expect(restored?.deletionReason).toBeUndefined();
    expect(store.get("a")?.deletedAt).toBeUndefined();
  });

  it("restoreStudentById returns an active record unchanged without saving", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    const useCases = createStudentsUseCases(repo);

    const restored = await useCases.restoreStudentById("a");

    expect(restored?.id).toBe("a");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("restoreStudentById rejects when the GR number collides with an active student", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a", { deletedAt: "2026-07-27T00:00:00.000Z", grNumber: "GR-1" }));
    vi.mocked(repo.findRegistrationConflict).mockResolvedValue("grNumber");
    const useCases = createStudentsUseCases(repo);

    await expect(useCases.restoreStudentById("a")).rejects.toBeInstanceOf(
      StudentRestoreConflictError,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("bulkRestoreStudents restores deleted rows and reports active rows as failed", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeStudent("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    store.set("active", fakeStudent("active"));
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["a", "active"]);

    expect(result).toEqual({ succeeded: 1, failed: 1, conflicts: [] });
    expect(store.get("a")?.deletedAt).toBeUndefined();
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledTimes(1);
  });

  it("bulkRestoreStudents collects GR conflicts without saving conflicting rows", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a", { deletedAt: "2026-07-27T00:00:00.000Z", grNumber: "GR-1" }));
    store.set("ok", fakeStudent("ok", { deletedAt: "2026-07-27T00:00:00.000Z", grNumber: "GR-2" }));
    vi.mocked(repo.findActiveGrNumberOwners).mockResolvedValue(new Map([["gr-1", "other-active"]]));
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["a", "ok"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([
      {
        id: "a",
        errors: [{ field: "grNumber", message: "A student with this GR number already exists" }],
      },
    ]);
    expect(store.get("a")?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get("ok")?.deletedAt).toBeUndefined();
  });

  it("bulkRestoreStudents detects case-insensitive in-batch GR collisions", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "s1",
      fakeStudent("s1", { deletedAt: "2026-07-27T00:00:00.000Z", grNumber: "GR-100" }),
    );
    store.set(
      "s2",
      fakeStudent("s2", { deletedAt: "2026-07-27T00:00:00.000Z", grNumber: "gr-100" }),
    );
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["s1", "s2"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([
      {
        id: "s2",
        errors: [{ field: "grNumber", message: "A student with this GR number already exists" }],
      },
    ]);
  });

  it("bulkRestoreStudents collects contact conflicts when contactId is in use", async () => {
    const { repo, store } = createFakeRepo();
    store.set("s1", fakeStudent("s1", { deletedAt: "2026-07-27T00:00:00.000Z", contactId: "c-1" }));
    store.set("s2", fakeStudent("s2", { deletedAt: "2026-07-27T00:00:00.000Z", contactId: "c-2" }));
    vi.mocked(repo.listLinkedContactIds).mockResolvedValue(["c-1"]);
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["s1", "s2"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([
      {
        id: "s1",
        errors: [{ field: "contact", message: "A student with this contact already exists" }],
      },
    ]);
    expect(store.get("s1")?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get("s2")?.deletedAt).toBeUndefined();
  });

  it("bulkRestoreStudents collects studentId conflicts without saving conflicting rows", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "s1",
      fakeStudent("s1", { deletedAt: "2026-07-27T00:00:00.000Z", studentId: "STD-1" }),
    );
    store.set(
      "ok",
      fakeStudent("ok", { deletedAt: "2026-07-27T00:00:00.000Z", studentId: "STD-2" }),
    );
    vi.mocked(repo.findActiveStudentIdOwners!).mockResolvedValue(
      new Map([["std-1", "other-active"]]),
    );
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["s1", "ok"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([
      {
        id: "s1",
        errors: [{ field: "studentId", message: "A student with this Student ID already exists" }],
      },
    ]);
    expect(store.get("s1")?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get("ok")?.deletedAt).toBeUndefined();
  });

  it("bulkRestoreStudents detects case-insensitive in-batch studentId collisions", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "s1",
      fakeStudent("s1", { deletedAt: "2026-07-27T00:00:00.000Z", studentId: "STD-100" }),
    );
    store.set(
      "s2",
      fakeStudent("s2", { deletedAt: "2026-07-27T00:00:00.000Z", studentId: "std-100" }),
    );
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkRestoreStudents(["s1", "s2"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([
      {
        id: "s2",
        errors: [{ field: "studentId", message: "A student with this Student ID already exists" }],
      },
    ]);
  });

  it("countStudents counts only active rows via the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    store.set("b", fakeStudent("b"));
    store.set("gone", fakeStudent("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createStudentsUseCases(repo);

    expect(await useCases.countStudents()).toBe(2);
    expect(repo.countByWorkspace).toHaveBeenCalledWith("demo", { deleted: "active" });
  });

  it("loadStudentById hides deleted rows unless includeDeleted is set", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createStudentsUseCases(repo);

    expect(await useCases.loadStudentById("a")).toBeNull();
    expect((await useCases.loadStudentById("a", true))?.id).toBe("a");
  });

  it("loadStudentsCommandMetrics delegates to the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.aggregateCommandMetrics).mockResolvedValue({
      total: 4,
      active: 3,
      inactive: 1,
      suspended: 0,
      newThisPeriod: 2,
    });
    const useCases = createStudentsUseCases(repo);

    const metrics = await useCases.loadStudentsCommandMetrics();

    expect(metrics.total).toBe(4);
    expect(repo.aggregateCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("loadStudentsWidgetAggregates passes queries to the injected repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createStudentsUseCases(repo);

    await useCases.loadStudentsWidgetAggregates([{ id: "w1", operation: "count" }]);

    expect(repo.aggregateWidgetQueries).toHaveBeenCalledWith("demo", [
      { id: "w1", operation: "count" },
    ]);
  });

  it("bulkUpdateStudentStatus delegates to the SQL bulk update and broadcasts", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.bulkUpdateStatusSql).mockResolvedValue(2);
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.bulkUpdateStudentStatus(["s-1", "s-2"], "inactive");

    expect(result).toEqual({ succeeded: 2, failed: 0 });
    expect(repo.bulkUpdateStatusSql).toHaveBeenCalledWith("demo", ["s-1", "s-2"], "inactive");
    expect(mockBroadcastCollection).toHaveBeenCalledWith("students");
  });

  it("computeNextGrNumberForDate formats the next sequence from the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.countNextGrNumber).mockResolvedValue(5);
    const useCases = createStudentsUseCases(repo);

    const grNumber = await useCases.computeNextGrNumberForDate("2026-08-10", {
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
    });

    expect(grNumber).toBe("0006-2026");
    expect(repo.countNextGrNumber).toHaveBeenCalledWith("demo", {
      regDate: "2026-08-10",
      restartAnnually: true,
    });
  });

  it("computeNextGrNumberForDate falls back to current year when regDate is invalid", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.countNextGrNumber).mockResolvedValue(0);
    const useCases = createStudentsUseCases(repo);

    const grNumber = await useCases.computeNextGrNumberForDate("invalid-date", {
      grNumberTemplate: "{seq}-{year}",
      grNumberDigits: 4,
      grNumberRestartAnnually: true,
    });

    const currentYear = new Date().getFullYear();
    expect(grNumber).toBe(`0001-${currentYear}`);
    expect(grNumber).not.toContain("NaN");
  });

  it("checkStudentRegistrationDuplicate returns the conflict reason from the repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.findRegistrationConflict).mockResolvedValue("email");
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.checkStudentRegistrationDuplicate({ email: "a@b.com" });

    expect(result).toEqual({ reason: "email" });
    expect(repo.findRegistrationConflict).toHaveBeenCalledWith("demo", { email: "a@b.com" });
  });

  it("sanitizeStudentForViewer passes the record through when no field config is registered", async () => {
    const { repo } = createFakeRepo();
    mockLoadStudentFieldConfig.mockResolvedValue(null);
    const useCases = createStudentsUseCases(repo);

    const student = fakeStudent("a", { phone: "+923001234567" });
    expect(await useCases.sanitizeStudentForViewer(student, "teacher")).toEqual(student);
  });

  it("sanitizeStudentForViewer hides disabled fields per the field config", async () => {
    const { repo } = createFakeRepo();
    mockLoadStudentFieldConfig.mockResolvedValue({
      fields: {
        basic: [
          { key: "phone", label: "Phone", type: "text", enabled: false, order: 0 },
          { key: "city", label: "City", type: "text", enabled: true, order: 1 },
        ],
      },
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
    });
    const useCases = createStudentsUseCases(repo);

    const student = fakeStudent("a", { phone: "+923001234567", city: "Karachi" });
    const sanitized = await useCases.sanitizeStudentForViewer(student, "teacher");

    expect(sanitized.phone).toBeUndefined();
    expect(sanitized.city).toBe("Karachi");
  });

  it("sanitizeStudentsForViewer strips disabled fields across every row", async () => {
    const { repo } = createFakeRepo();
    mockLoadStudentFieldConfig.mockResolvedValue({
      fields: {
        basic: [
          { key: "phone", label: "Phone", type: "text", enabled: false, order: 0 },
          { key: "city", label: "City", type: "text", enabled: true, order: 1 },
        ],
      },
      formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
    });
    const useCases = createStudentsUseCases(repo);

    const students = [
      fakeStudent("a", { phone: "+923001234567", city: "Karachi" }),
      fakeStudent("b", { phone: "+923009999999", city: "Lahore" }),
    ];
    const sanitized = await useCases.sanitizeStudentsForViewer(students, "teacher");

    expect(sanitized[0]?.phone).toBeUndefined();
    expect(sanitized[0]?.city).toBe("Karachi");
    expect(sanitized[1]?.phone).toBeUndefined();
    expect(sanitized[1]?.city).toBe("Lahore");
  });

  it("sanitizeStudentsForViewer returns rows unchanged when no field config is registered", async () => {
    const { repo } = createFakeRepo();
    mockLoadStudentFieldConfig.mockResolvedValue(null);
    const useCases = createStudentsUseCases(repo);

    const students = [fakeStudent("a", { phone: "+923001234567" })];
    expect(await useCases.sanitizeStudentsForViewer(students, "teacher")).toEqual(students);
  });

  it("loadStudentsByIds returns matched rows from the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeStudent("a"));
    store.set("b", fakeStudent("b"));
    const useCases = createStudentsUseCases(repo);

    const rows = await useCases.loadStudentsByIds(["a", "missing", "b"]);

    expect(rows.map((s) => s.id)).toEqual(["a", "b"]);
    expect(repo.findByIds).toHaveBeenCalledWith("demo", ["a", "missing", "b"]);
  });

  it("loadStudentsByIds returns an empty array for empty input without hitting the repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createStudentsUseCases(repo);

    expect(await useCases.loadStudentsByIds([])).toEqual([]);
    expect(repo.findByIds).not.toHaveBeenCalled();
  });

  it("loadStudentLinkedContactIds delegates to the injected repo", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.listLinkedContactIds).mockResolvedValue(["c-1", "c-2"]);
    const useCases = createStudentsUseCases(repo);

    const ids = await useCases.loadStudentLinkedContactIds("s-exclude");

    expect(ids).toEqual(["c-1", "c-2"]);
    expect(repo.listLinkedContactIds).toHaveBeenCalledWith("demo", "s-exclude");
  });

  it("migrateStudentsMissingGrNumbers assigns sequential GR numbers to active rows", async () => {
    const { repo, store } = createFakeRepo();
    const missing = [
      fakeStudent("m1", { registeredDate: "2026-01-05" }),
      fakeStudent("m2", { registeredDate: "2026-01-06" }),
    ];
    vi.mocked(repo.listActiveMissingGrNumber).mockResolvedValue(missing);
    const countNextGrNumberMock = vi.mocked(repo.countNextGrNumber);
    countNextGrNumberMock.mockImplementation(async (_tenant, input) => {
      void input;
      // countNextGrNumber is called once per persisted row; return a growing count.
      return countNextGrNumberMock.mock.calls.length - 1;
    });
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.migrateStudentsMissingGrNumbers();

    expect(result).toEqual({ updated: 2, hasMore: false });
    expect(typeof store.get("m1")?.grNumber).toBe("string");
    expect(typeof store.get("m2")?.grNumber).toBe("string");
    expect(store.get("m2")?.grNumber).not.toBe(store.get("m1")?.grNumber);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("students");
  });

  it("migrateStudentsMissingGrNumbers is a no-op when no rows are missing", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.listActiveMissingGrNumber).mockResolvedValue([]);
    const useCases = createStudentsUseCases(repo);

    const result = await useCases.migrateStudentsMissingGrNumbers();

    expect(result).toEqual({ updated: 0, hasMore: false });
    expect(repo.countNextGrNumber).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).not.toHaveBeenCalled();
  });
});
