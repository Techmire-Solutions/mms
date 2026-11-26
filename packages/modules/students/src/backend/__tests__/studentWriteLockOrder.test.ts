import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student, User } from "@mms/contracts";
import { runWithTenant } from "@mms/be-core/http";
import type { StudentsRepository } from "../repository/studentsRepository.js";

const callOrder: string[] = [];

vi.mock("../deps.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../deps.js")>();
  return {
    ...actual,
    reconcileContactSystemTags: vi.fn(async () => {
      callOrder.push("reconcileContactSystemTags");
      return 1;
    }),
  };
});

vi.mock("@mms/be-core/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/be-core/audit")>();
  return {
    ...actual,
    recordModernAuditEvent: vi.fn(async () => {
      callOrder.push("recordModernAuditEvent");
      return {
        id: 1,
        hashPrevious: "0".repeat(64),
        hashCurrent: "a".repeat(64),
        canonicalPayload: "{}",
      };
    }),
    sanitizeAuditState: (value: unknown) => value,
  };
});

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn(async () => undefined),
  emitOutboxEvents: vi.fn(async () => undefined),
}));

vi.mock("@mms/db/client", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  activeDb: () => ({}),
  runInTransaction: (callback: () => unknown) => callback(),
}));

vi.mock("@mms/db/soft-delete", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  enableIncludeDeleted: vi.fn(async () => undefined),
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: vi.fn(async () => undefined),
}));

vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: vi.fn(async () => undefined),
}));

vi.mock("../repository/db/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn(async () => undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn(async () => undefined),
}));

vi.mock("../use-cases/studentStatusTransitionUseCases.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../use-cases/studentStatusTransitionUseCases.js")>();
  return {
    ...actual,
    withdrawEnrollmentsEndedByStatus: vi.fn(async () => undefined),
  };
});

const { bulkSoftDeleteStudents } = await import("../use-cases/studentSoftDeleteUseCases.js");
const { restoreStudentById, bulkRestoreStudents } =
  await import("../use-cases/studentRestoreUseCases.js");
const { bulkUpdateStudentStatus } = await import("../use-cases/studentOperationUseCases.js");

function makeStudent(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    contactId: `c-${id}`,
    name: "Zayd Ali",
    grNumber: `GR-${id}`,
    status: "active",
    ...overrides,
  } as Student;
}

describe("Students write advisory-lock order", () => {
  beforeEach(() => {
    callOrder.length = 0;
  });

  it("given bulkSoftDeleteStudents, should reconcile contact system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const student = makeStudent("s-1");
    const repo = {
      findByIds: vi.fn(async () => [student]),
      bulkSoftDelete: vi.fn(async () => ({ succeeded: 1, deletedIds: ["s-1"] })),
    } as unknown as StudentsRepository;

    // Act
    await runWithTenant("ops-tenant", () => bulkSoftDeleteStudents(["s-1"], "u-1", "Left", repo));

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });

  it("given restoreStudentById, should reconcile contact system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const trashed = makeStudent("s-1", { deletedAt: "2026-02-01T00:00:00.000Z" });
    const repo = {
      findById: vi.fn(async () => trashed),
      findRegistrationConflict: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
    } as unknown as StudentsRepository;

    // Act
    await runWithTenant("ops-tenant", () => restoreStudentById("s-1", "u-1", repo));

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });

  it("given bulkRestoreStudents, should reconcile contact system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const trashed = makeStudent("s-1", { deletedAt: "2026-02-01T00:00:00.000Z" });
    const repo = {
      findByIds: vi.fn(async () => [trashed]),
      findActiveGrNumberOwners: vi.fn(async () => new Map()),
      bulkRestore: vi.fn(async () => ({ succeeded: 1, restoredIds: ["s-1"] })),
    } as unknown as StudentsRepository;

    // Act
    await runWithTenant("ops-tenant", () => bulkRestoreStudents(["s-1"], "u-1", repo));

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });

  it("given bulkUpdateStudentStatus, should reconcile contact system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const active = makeStudent("s-1", { status: "active" });
    const repo = {
      findByIds: vi.fn(async () => [active]),
      bulkUpdateStatusSql: vi.fn(async () => ({ succeeded: 1, updatedIds: ["s-1"] })),
    } as unknown as StudentsRepository;
    const actor = { id: "u-1", role: "admin" } as User;

    // Act
    await runWithTenant("ops-tenant", () =>
      bulkUpdateStudentStatus(["s-1"], "inactive", repo, actor),
    );

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });
});
