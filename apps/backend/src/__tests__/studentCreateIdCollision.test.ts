import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";

const mockGetRequestTenant = vi.fn(() => "demo");
const mockBroadcastCollection = vi.fn();
const mockRestoreCascadedEnrollments = vi.fn();
const mockReconcileContactSystemTags = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({}),
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: (...args: unknown[]) =>
    mockRestoreCascadedEnrollments(...args),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcileContactSystemTags(...args),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
  sanitizeAuditState: (value: unknown) => value,
}));

vi.mock("../students/use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: vi.fn().mockResolvedValue({}),
}));

import { createStudentsUseCases } from "../students/use-cases/studentUseCases.js";
import {
  StudentCreateIdConflictError,
  StudentPermissionError,
} from "../students/use-cases/studentNormalizeUseCases.js";

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
    bulkUpdateStatusSql: vi.fn(async () => 0),
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
