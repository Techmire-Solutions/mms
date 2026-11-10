import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Distribution, Redemption } from "@mms/shared";
import {
  cardAuditSnapshot,
  auditCardMutation,
  auditLedgerMutation,
  auditAwardMutation,
  auditSetupMutation,
} from "../hasanat/use-cases/hasanatAudit.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

const auditCalls: Array<Record<string, unknown>> = [];

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(async (params: Record<string, unknown>) => {
    auditCalls.push(params);
    return { sequence: 1, hashCurrent: "h", hashPrevious: "p" };
  }),
}));

describe("hasanatAudit use-cases", () => {
  beforeEach(() => {
    auditCalls.length = 0;
    vi.clearAllMocks();
  });

  it("extracts clean non-PII card snapshot via cardAuditSnapshot", () => {
    const card: Distribution = {
      id: "card-1",
      workspaceSubdomain: "demo",
      recipientStudentId: "student-1",
      recipientFacultyId: null,
      classId: "class-1",
      sessionId: "session-1",
      batchId: "batch-1",
      denominationId: "denom-1",
      quantity: 5,
      pointsSnapshot: 25,
      status: "active",
      issuedDate: "2026-11-10",
      expiresOn: null,
      deletedAt: null,
      version: 1,
    } as unknown as Distribution;

    const snapshot = cardAuditSnapshot(card);
    expect(snapshot).toEqual({
      studentId: "student-1",
      facultyId: null,
      classId: "class-1",
      sessionId: "session-1",
      batchId: "batch-1",
      denominationId: "denom-1",
      quantity: 5,
      pointsSnapshot: 25,
      status: "active",
      issuedDate: "2026-11-10",
      expiresOn: null,
      deletedAt: null,
      version: 1,
    });
  });

  it("emits modern audit event for card mutation", async () => {
    const card: Distribution = {
      id: "card-1",
      workspaceSubdomain: "demo",
      recipientStudentId: "student-1",
      batchId: "batch-1",
      denominationId: "denom-1",
      quantity: 1,
      status: "active",
      issuedDate: "2026-11-10",
    } as unknown as Distribution;

    await auditCardMutation({
      tenant: "demo",
      actorUserId: "user-123",
      action: "CREATE",
      reason: "Issuing points",
      card,
    });

    expect(recordModernAuditEvent).toHaveBeenCalledTimes(1);
    expect(auditCalls[0]).toMatchObject({
      workspaceSubdomain: "demo",
      tableName: "hasanat_distributions",
      recordId: "card-1",
      actionType: "CREATE",
      realUserId: "user-123",
      newState: expect.objectContaining({
        studentId: "student-1",
        reason: "Issuing points",
      }),
    });
  });

  it("emits ledger mutation for redemptions", async () => {
    const redemption: Redemption = {
      id: "red-1",
      distributionId: "card-1",
      studentId: "student-1",
      kind: "burn",
      pointsUsed: 10,
      reversalOfId: null,
      date: "2026-11-10",
      approvedByUserId: "admin-1",
    } as unknown as Redemption;

    await auditLedgerMutation({
      tenant: "demo",
      actorUserId: "admin-1",
      action: "CREATE",
      redemption,
    });

    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "hasanat_redemptions",
        recordId: "red-1",
        actionType: "CREATE",
        realUserId: "admin-1",
        newState: expect.objectContaining({
          pointsUsed: 10,
        }),
      }),
    );
  });

  it("emits award mutation for tier changes", async () => {
    await auditAwardMutation({
      tenant: "demo",
      action: "CREATE",
      award: {
        id: "award-1",
        tierKey: "gold",
        tierName: "Gold Tier",
        earnedSnapshot: 500,
        awardedAt: "2026-11-10T12:00:00Z",
        revokedAt: null,
        revokedReason: null,
      },
    });

    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "hasanat_student_awards",
        recordId: "award-1",
        actionType: "CREATE",
      }),
    );
  });

  it("emits setup mutation for point catalogue edits", async () => {
    await auditSetupMutation({
      tenant: "demo",
      action: "UPDATE",
      tableName: "hasanat_denominations",
      recordId: "denom-1",
      after: { points: 50 },
    });

    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "hasanat_denominations",
        recordId: "denom-1",
        actionType: "UPDATE",
        newState: expect.objectContaining({ points: 50 }),
      }),
    );
  });
});
