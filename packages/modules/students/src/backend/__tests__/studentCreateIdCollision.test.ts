import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/contracts";
import type { StudentsRepository } from "../repository/studentsRepository.js";

const mockGetRequestTenant = vi.fn(() => "demo");
const mockBroadcastCollection = vi.fn();
const mockRestoreCascadedEnrollments = vi.fn();
const mockReconcileContactSystemTags = vi.fn();

vi.mock("@mms/be-core/http", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("@mms/db/client", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({}),
}));

vi.mock("../repository/db/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: (...args: unknown[]) =>
    mockRestoreCascadedEnrollments(...args),
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../deps.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcileContactSystemTags(...args),
}));

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/be-core/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/be-core/audit")>();
  return {
    ...actual,
    recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
    sanitizeAuditState: (value: unknown) => value,
  };
});

vi.mock("../use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: vi.fn().mockResolvedValue({}),
}));

import { createStudentsUseCases } from "../use-cases/studentUseCases.js";
import {
  StudentCreateIdConflictError,
  StudentPermissionError,
} from "../use-cases/studentNormalizeUseCases.js";

const admin = { id: "u-admin", role: "admin" } as never;
const teacher = { id: "u-teacher", role: "teacher" } as never;

function archivedStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "s-archived",
    contactId: "c-archived",
    name: "Archived Student",
    grNumber: "gr-1",
    notes: "keep me",
    status: "active",
    deletedAt: "2026-01-01T00:00:00.000Z",
    deletedBy: "u-admin",
    deletionReason: "duplicate",
    ...overrides,
  };
}

/** In-memory fake repository shared with the use-case composition root. */
function createFakeRepo(seed: Student[] = []) {
  const store = new Map<string, Student>(seed.map((student) => [String(student.id), student]));
  const repo = {
    countByWorkspace: vi.fn(async () => store.size),
    listPage: vi.fn(async () => ({
      students: [...store.values()],
      total: store.size,
      page: 1,
      limit: 50,
      hasMore: false,
    })),
    findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((student): student is Student => Boolean(student)),
    ),
    save: vi.fn(async (_tenant: string, student: Student) => {
      store.set(String(student.id), student);
    }),
    bulkSave: vi.fn(async () => undefined),
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
    findActiveGrNumberOwners: vi.fn(async () => new Map<string, string>()),
    findActiveStudentIdOwners: vi.fn(async () => new Map<string, string>()),
    findSoftDeletedByContactId: vi.fn(async () => null),
    listActiveMissingGrNumber: vi.fn(async () => []),
    bulkUpdateStatusSql: vi.fn(async () => ({ succeeded: 0, updatedIds: [] })),
    bulkSoftDelete: vi.fn(async () => ({ succeeded: 0, failed: 0 })),
    bulkRestore: vi.fn(async () => ({ succeeded: 0, failed: 0 })),
  };
  return { store, repo: repo as unknown as StudentsRepository, spies: repo };
}

describe("createStudent id-collision guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("rejects with a 409 when the id already belongs to an active student", async () => {
    const active = archivedStudent({
      id: "s-active",
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
    });
    const fake = createFakeRepo([active]);
    const useCases = createStudentsUseCases(fake.repo);

    await expect(
      useCases.createStudent(
        { id: "s-active", contactId: "c-new", notes: "overwrite attempt" } as never,
        { user: admin } as never,
      ),
    ).rejects.toBeInstanceOf(StudentCreateIdConflictError);

    expect(fake.spies.save).not.toHaveBeenCalled();
    expect(fake.store.get("s-active")?.notes).toBe("keep me");
  });

  it("maps an insert-only primary-key collision to a 409 id conflict", async () => {
    const fake = createFakeRepo();
    fake.repo.saveInsertOnly = vi.fn(async () => {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
        constraint: "students_pkey",
      });
    });
    const useCases = createStudentsUseCases(fake.repo);

    await expect(
      useCases.createStudent(
        { id: "s-fresh", contactId: "c-new", notes: "race" } as never,
        { user: admin } as never,
      ),
    ).rejects.toBeInstanceOf(StudentCreateIdConflictError);
    expect(fake.spies.save).not.toHaveBeenCalled();
  });

  it("keeps the GR-specific message for a non-id unique violation on the insert-only path", async () => {
    const fake = createFakeRepo();
    fake.repo.saveInsertOnly = vi.fn(async () => {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
        constraint: "students_workspace_gr_number_active_uidx",
      });
    });
    const useCases = createStudentsUseCases(fake.repo);

    await expect(
      useCases.createStudent(
        { contactId: "c-new", notes: "gr collision" } as never,
        { user: admin } as never,
      ),
    ).rejects.toMatchObject({ statusCode: 409, field: "grNumber" });
  });

  it("refuses to resurrect a soft-deleted id without delete permission", async () => {
    const fake = createFakeRepo([archivedStudent()]);
    const useCases = createStudentsUseCases(fake.repo);

    await expect(
      useCases.createStudent(
        { id: "s-archived", contactId: "c-archived" } as never,
        { user: teacher } as never,
      ),
    ).rejects.toBeInstanceOf(StudentPermissionError);

    expect(fake.spies.save).not.toHaveBeenCalled();
    expect(fake.store.get("s-archived")?.deletedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("restores a soft-deleted id in place when the caller may delete", async () => {
    const fake = createFakeRepo([archivedStudent()]);
    const useCases = createStudentsUseCases(fake.repo);

    const result = await useCases.createStudent(
      { id: "s-archived", contactId: "c-archived", notes: "fresh note" } as never,
      { user: admin } as never,
    );

    expect(result.restored).toBe(true);
    expect(result.record.id).toBe("s-archived");
    const stored = fake.store.get("s-archived");
    expect(stored?.deletedAt).toBeUndefined();
    expect(stored?.notes).toBe("fresh note");
    expect(stored?.restoredBy).toBe("u-admin");
    expect(stored?.restoredAt).toEqual(expect.any(String));
    expect(mockRestoreCascadedEnrollments).toHaveBeenCalledTimes(1);
  });

  it("creates a generated id when the payload carries none", async () => {
    const fake = createFakeRepo();
    const useCases = createStudentsUseCases(fake.repo);

    const result = await useCases.createStudent(
      { contactId: "c-new", notes: "brand new" } as never,
      { user: admin } as never,
    );

    expect(result.restored).toBe(false);
    expect(String(result.record.id)).toMatch(/^st-/);
    expect(fake.spies.save).toHaveBeenCalledTimes(1);
  });

  it("stamps create attribution from the session, never the payload", async () => {
    const fake = createFakeRepo();
    const useCases = createStudentsUseCases(fake.repo);

    const result = await useCases.createStudent(
      { contactId: "c-new", createdBy: "spoofed-user" } as never,
      { user: admin } as never,
    );

    expect(result.record.createdBy).toBe("u-admin");
    expect(result.record.updatedBy).toBe("u-admin");
  });
});
