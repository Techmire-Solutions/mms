import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_LEAVE_TRANSITIONS,
  canTransitionAttendanceLeave,
  isAttendanceLeaveDecision,
  isAttendanceLeaveEffective,
} from "./attendanceLeaveTransitions.js";

describe("attendance leave transitions", () => {
  it("starts only as pending", () => {
    expect(canTransitionAttendanceLeave(null, "pending")).toBe(true);
    expect(canTransitionAttendanceLeave(undefined, "approved")).toBe(false);
    expect(canTransitionAttendanceLeave(undefined, "pending")).toBe(true);
  });

  it("decides a pending request exactly once", () => {
    expect(canTransitionAttendanceLeave("pending", "approved")).toBe(true);
    expect(canTransitionAttendanceLeave("pending", "rejected")).toBe(true);
    expect(canTransitionAttendanceLeave("pending", "cancelled")).toBe(true);
  });

  it("keeps decided requests terminal", () => {
    expect(canTransitionAttendanceLeave("rejected", "approved")).toBe(false);
    expect(canTransitionAttendanceLeave("rejected", "pending")).toBe(false);
    expect(canTransitionAttendanceLeave("cancelled", "approved")).toBe(false);
    expect(canTransitionAttendanceLeave("cancelled", "pending")).toBe(false);
  });

  it("allows revoking an approved leave, but not reviving it", () => {
    expect(canTransitionAttendanceLeave("approved", "cancelled")).toBe(true);
    expect(canTransitionAttendanceLeave("approved", "pending")).toBe(false);
    expect(canTransitionAttendanceLeave("approved", "rejected")).toBe(false);
  });

  it("declares a table entry for every status", () => {
    for (const [from, tos] of Object.entries(ATTENDANCE_LEAVE_TRANSITIONS)) {
      expect(tos.length).toBeGreaterThan(0);
      // Every status is reachable from itself (idempotent re-save) or terminal.
      expect(tos.includes(from as never)).toBe(true);
    }
  });

  it("flags decisions and effective leave", () => {
    expect(isAttendanceLeaveDecision("approved")).toBe(true);
    expect(isAttendanceLeaveDecision("rejected")).toBe(true);
    expect(isAttendanceLeaveDecision("cancelled")).toBe(false);
    expect(isAttendanceLeaveEffective("approved")).toBe(true);
    expect(isAttendanceLeaveEffective("  Approved ")).toBe(true);
    expect(isAttendanceLeaveEffective("pending")).toBe(false);
  });
});
