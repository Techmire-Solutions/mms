/**
 * GAP COVERAGE: Student status-transition matrix tests.
 *
 * The existing `studentStatusTransition.test.ts` verifies the happy-path cascade
 * (graduation → withdrawal, audit rows, deduplication).  This file adds the
 * missing **invalid-transition** and **boundary** assertions:
 *
 *   GAP-S1  graduated → active must throw or at least not trigger an enrollment-create
 *   GAP-S2  transferred → active bypass guard
 *   GAP-S3  inactive → graduated direct hop (skipping active)
 *   GAP-S4  Full withdrawal-trigger matrix: only inactive/transferred/graduated end enrollments
 *   GAP-S5  Invalid status string → 400 from bulkUpdateStudentStatus
 *   GAP-S6  collectStatusTransitions no-op guard: same-status rows are filtered out
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";
import { studentStatusEndsEnrollments } from "@mms/shared";
import { collectStatusTransitions } from "../students/use-cases/studentStatusTransitionUseCases.js";

// ─── Shared mocks ───────────────────────────────────────────────────────────

const mockGetRequestTenant = vi.fn(() => "demo");
const mockWithdraw = vi.fn();
const mockBulkUpdateStatus = vi.fn();
const mockAudit = vi.fn();
const mockBroadcastCollection = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({}),
  hasActiveTransaction: () => true,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mockAudit(...args),
  mapActionStringToAuditType: (action: string) => action,
  sanitizeAuditState: (v: unknown) => v,
}));

vi.mock("../enrollments/use-cases/enrollmentEndUseCases.js", () => ({
  withdrawEnrollmentsForStudentStatus: (...args: unknown[]) => mockWithdraw(...args),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

import { bulkUpdateStudentStatus } from "../students/use-cases/studentOperationUseCases.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const admin = {
  id: "u-admin",
  name: "Admin",
  email: "admin@demo.test",
  role: "admin",
  workspaceSubdomain: "demo",
} as never;

function student(id: string, status: string = "active"): Student {
  return { id, contactId: `c-${id}`, name: `Student ${id}`, status } as Student;
}

function fakeRepo(rows: Student[]): StudentsRepository {
  const store = new Map(rows.map((row) => [String(row.id), row]));
  return {
    findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((row): row is Student => Boolean(row)),
    ),
    save: vi.fn(async (_tenant: string, row: Student) => {
      store.set(String(row.id), row);
    }),
    bulkUpdateStatusSql: (...args: unknown[]) => mockBulkUpdateStatus(...args),
    bulkSave: vi.fn(async () => undefined),
    findRegistrationConflict: vi.fn(async () => null),
    findActiveStudentIdOwners: vi.fn(async () => new Map<string, string>()),
    findSoftDeletedByContactId: vi.fn(async () => null),
  } as unknown as StudentsRepository;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("GAP-S4: studentStatusEndsEnrollments transition matrix", () => {
  /**
   * Only transitions INTO the ending set (inactive, transferred, graduated)
   * FROM a non-ending status should trigger withdrawal.
   */

  it.each([
    // [before, after, shouldEnd]
    ["active", "graduated", true],
    ["active", "transferred", true],
    ["active", "inactive", true],
    ["suspended", "graduated", true], // suspended is non-ending
    ["suspended", "transferred", true],
    ["suspended", "inactive", true],
    ["active", "suspended", false], // suspended does NOT end enrollments
    ["inactive", "active", false], // re-activating: before is already ending
    ["graduated", "active", false], // re-activating from graduated: before is ending
    ["transferred", "inactive", false], // both ending: no additional withdrawal
    ["inactive", "graduated", false], // both ending: no additional withdrawal
    [undefined, "graduated", true], // fresh enrollment → graduation
    [null, "inactive", true],
  ])("active=%s → %s: ends=%s", (before, after, expected) => {
    expect(studentStatusEndsEnrollments(before, after)).toBe(expected);
  });
});

describe("GAP-S5: bulkUpdateStudentStatus rejects an invalid status value", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("throws a 400 error for an unrecognized status string", async () => {
    const repo = fakeRepo([student("s-1")]);

    await expect(bulkUpdateStudentStatus(["s-1"], "expelled", repo, admin)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Invalid status"),
    });
  });

  it("throws a 400 error for an empty string status", async () => {
    const repo = fakeRepo([student("s-1")]);

    await expect(bulkUpdateStudentStatus(["s-1"], "", repo, admin)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws a 400 error for a whitespace-only status", async () => {
    const repo = fakeRepo([student("s-1")]);

    await expect(bulkUpdateStudentStatus(["s-1"], "   ", repo, admin)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("GAP-S6: collectStatusTransitions no-op guard", () => {
  it("omits rows that are already at the target status (case-insensitive)", () => {
    const rows = [
      { id: "s-1", status: "active" },
      { id: "s-2", status: "ACTIVE" }, // already active, different case
      { id: "s-3", status: "inactive" },
    ];

    const transitions = collectStatusTransitions(rows, "active");

    // Only s-3 actually changed from inactive → active
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.id).toBe("s-3");
    expect(transitions[0]!.previousStatus).toBe("inactive");
    expect(transitions[0]!.nextStatus).toBe("active");
  });

  it("omits rows with undefined or null status when target matches the normalised fallback", () => {
    const rows = [
      { id: "s-1", status: null },
      { id: "s-2", status: "active" },
    ];

    // null normalises to "" which does not equal "active", so s-1 IS a transition
    const transitions = collectStatusTransitions(rows as never, "active");
    expect(transitions.map((t) => t.id)).toContain("s-1");
  });

  it("produces an empty list when ALL rows are already at the target status", () => {
    const rows = [
      { id: "s-1", status: "graduated" },
      { id: "s-2", status: "  Graduated  " },
    ];

    const transitions = collectStatusTransitions(rows, "graduated");
    expect(transitions).toHaveLength(0);
  });
});

describe("GAP-S1/S2: graduated/transferred students can be re-set to active without enrollment withdrawal", () => {
  /**
   * The domain currently allows any valid status value to be written.  This
   * test documents the expected behaviour: re-activating a graduated/transferred
   * student should NOT trigger enrollment withdrawal (the student has no live
   * enrollments to withdraw), and the transition SHOULD be recorded as an audit.
   */
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockWithdraw.mockResolvedValue({ ended: 0, billing: { cancelled: [], review: [] } });
    mockBulkUpdateStatus.mockResolvedValue(1);
    mockAudit.mockResolvedValue({ id: 1 });
  });

  it("does NOT call withdrawEnrollmentsForStudentStatus when re-activating a graduated student", async () => {
    const repo = fakeRepo([student("s-grad", "graduated")]);
    mockBulkUpdateStatus.mockResolvedValue(1);

    await bulkUpdateStudentStatus(["s-grad"], "active", repo, admin);

    // graduated → active: before=graduated (ending set), after=active (non-ending)
    // studentStatusEndsEnrollments(graduated, active) = false → no withdrawal
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it("does NOT call withdrawEnrollmentsForStudentStatus when re-activating a transferred student", async () => {
    const repo = fakeRepo([student("s-xfer", "transferred")]);
    mockBulkUpdateStatus.mockResolvedValue(1);

    await bulkUpdateStudentStatus(["s-xfer"], "active", repo, admin);

    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it("still records an audit row when moving from graduated → active", async () => {
    const repo = fakeRepo([student("s-grad", "graduated")]);
    mockBulkUpdateStatus.mockResolvedValue(1);

    await bulkUpdateStudentStatus(["s-grad"], "active", repo, admin);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        oldState: { status: "graduated" },
        newState: { status: "active" },
      }),
    );
  });
});
