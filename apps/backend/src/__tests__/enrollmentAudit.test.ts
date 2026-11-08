import { describe, expect, it, vi } from "vitest";
import {
  changedEnrollmentFields,
  ENROLLMENT_AUDIT_REASON_CODES,
  recordEnrollmentAudit,
} from "../enrollments/use-cases/enrollmentAudit.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("enrollmentAudit", () => {
  it("contains all canonical machine-readable reason codes", () => {
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("create");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("status_change");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("fee_adjustment");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("transfer");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("withdraw");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("trash");
    expect(ENROLLMENT_AUDIT_REASON_CODES).toContain("restore");
  });

  describe("changedEnrollmentFields", () => {
    it("extracts only fields that actually changed", () => {
      const before = { status: "pending", finalFee: 100, classId: "c1" };
      const after = { status: "confirmed", finalFee: 100, classId: "c2" };

      const diff = changedEnrollmentFields(before, after, ["status", "finalFee", "classId"]);

      expect(diff.oldState).toEqual({ status: "pending", classId: "c1" });
      expect(diff.newState).toEqual({ status: "confirmed", classId: "c2" });
    });

    it("returns empty objects when none of the requested fields changed", () => {
      const before = { status: "active", finalFee: 250 };
      const after = { status: "active", finalFee: 250 };

      const diff = changedEnrollmentFields(before, after, ["status", "finalFee"]);

      expect(diff.oldState).toEqual({});
      expect(diff.newState).toEqual({});
    });
  });

  describe("recordEnrollmentAudit", () => {
    it("delegates to recordModernAuditEvent with tenant and reasonCode in newState", async () => {
      const fakeTx = {} as any;
      await recordEnrollmentAudit(fakeTx, "demo", {
        recordId: "enr-1",
        actionType: "UPDATE",
        reasonCode: "status_change",
        oldState: { status: "pending" },
        newState: { status: "confirmed" },
        actor: { id: "user-123" },
      });

      expect(recordModernAuditEvent).toHaveBeenCalledWith(fakeTx, {
        workspaceSubdomain: "demo",
        tableName: "enrollments",
        recordId: "enr-1",
        actionType: "UPDATE",
        realUserId: "user-123",
        oldState: { status: "pending" },
        newState: { reasonCode: "status_change", status: "confirmed" },
      });
    });

    it("handles actor with userId instead of id", async () => {
      const fakeTx = {} as any;
      await recordEnrollmentAudit(fakeTx, "demo", {
        recordId: "enr-2",
        actionType: "CREATE",
        reasonCode: "create",
        actor: { userId: "user-456" },
      });

      expect(recordModernAuditEvent).toHaveBeenCalledWith(fakeTx, {
        workspaceSubdomain: "demo",
        tableName: "enrollments",
        recordId: "enr-2",
        actionType: "CREATE",
        realUserId: "user-456",
        oldState: undefined,
        newState: { reasonCode: "create" },
      });
    });
  });
});
