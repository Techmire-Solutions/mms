import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";

const TENANT = "demo";
const mockBroadcastCollection = vi.fn();
const mockInvalidateMultiTierCache = vi.fn();
const mockWithdrawEnrollments = vi.fn();
const mockReconcileContactSystemTags = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => TENANT,
  requireTenant: () => TENANT,
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({ execute: async () => undefined }),
  hasActiveTransaction: () => true,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidateMultiTierCache(...args),
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcileContactSystemTags(...args),
}));

vi.mock("../students/use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: vi.fn().mockResolvedValue(null),
}));

vi.mock("../enrollments/use-cases/enrollmentEndUseCases.js", () => ({
  withdrawEnrollmentsForStudentStatus: (...args: unknown[]) => mockWithdrawEnrollments(...args),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
  mapActionStringToAuditType: (action: string) => action,
  sanitizeAuditState: (value: unknown) => value,
}));

import { createStudentsUseCases } from "../students/use-cases/studentUseCases.js";

const admin = { id: "u-admin", role: "admin" } as never;

function fakeStudent(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    contactId: `c-${id}`,
    name: `Student ${id}`,
    grNumber: `GR-${id}`,
    status: "active",
    ...overrides,
  };
}

function createRepo(seed: Student[] = []) {
  const store = new Map(seed.map((student) => [String(student.id), student]));
  return {
    findById: vi.fn(async (_tenant: string, id: string) => store.get(String(id)) ?? null),
    findSoftDeletedByContactId: vi.fn(async () => null),
    findRegistrationConflict: vi.fn(async () => null),
    findActiveStudentIdOwners: vi.fn(async () => new Map<string, string>()),
    save: vi.fn(async (_tenant: string, student: Student) => {
      store.set(String(student.id), student);
    }),
    bulkSave: vi.fn(async () => undefined),
  };
}

describe("students write-path cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithdrawEnrollments.mockResolvedValue(0);
  });

  it("invalidates the students cache after the create transaction commits", async () => {
    const repo = createRepo();
    const useCases = createStudentsUseCases(repo as unknown as StudentsRepository);

    await useCases.createStudent({ id: "s-1", contactId: "c-1", name: "Aisha" } as never, {
      user: admin,
    });

    expect(mockInvalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: TENANT,
      domain: "students",
    });
    expect(mockInvalidateMultiTierCache.mock.invocationCallOrder[0]).toBeGreaterThan(
      repo.save.mock.invocationCallOrder[0]!,
    );
  });

  it("invalidates after a rolled-back update so the eviction is never left to a pre-commit write", async () => {
    const repo = createRepo([fakeStudent("s-1")]);
    mockWithdrawEnrollments.mockRejectedValueOnce(new Error("seat release failed"));
    const useCases = createStudentsUseCases(repo as unknown as StudentsRepository);

    await expect(
      useCases.updateStudentById("s-1", { status: "graduated" } as never, { user: admin }),
    ).rejects.toThrow("seat release failed");

    expect(mockInvalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: TENANT,
      domain: "students",
    });
  });

  it("suppresses the collection broadcast when the caller defers it", async () => {
    // CSV import batches live-push once per chunk instead of once per row.
    const repo = createRepo();
    const useCases = createStudentsUseCases(repo as unknown as StudentsRepository);

    await useCases.createStudent({ id: "s-1", contactId: "c-1", name: "Aisha" } as never, {
      user: admin,
      deferBroadcast: true,
    });

    expect(mockBroadcastCollection).not.toHaveBeenCalled();
    // Cache eviction is not part of the broadcast contract — it still runs.
    expect(mockInvalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: TENANT,
      domain: "students",
    });
  });

  it("invalidates after an update commits", async () => {
    const repo = createRepo([fakeStudent("s-1")]);
    const useCases = createStudentsUseCases(repo as unknown as StudentsRepository);

    await useCases.updateStudentById("s-1", { notes: "updated" } as never, { user: admin });

    expect(mockInvalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: TENANT,
      domain: "students",
    });
  });
});
