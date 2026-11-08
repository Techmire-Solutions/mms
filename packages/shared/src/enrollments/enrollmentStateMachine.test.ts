import { describe, expect, it } from "vitest";
import {
  allowedApplicationTransitions,
  allowedEnrollmentTransitions,
  canTransitionApplication,
  canTransitionEnrollment,
  ENROLLMENT_TERMINAL_STATUSES,
  InvalidEnrollmentStatusError,
  isEnrollmentSuspended,
  isEnrollmentTerminal,
  parseEnrollmentStatus,
} from "./enrollmentStateMachine.js";

describe("canTransitionEnrollment", () => {
  it("allows the fee-confirmation edge on the manual channel and nothing else", () => {
    expect(canTransitionEnrollment("pending", "confirmed", { channel: "manual" })).toBe(true);
    expect(canTransitionEnrollment("pending", "cancelled", { channel: "manual" })).toBe(false);
    expect(canTransitionEnrollment("confirmed", "completed", { channel: "manual" })).toBe(false);
    expect(canTransitionEnrollment("withdrawn", "confirmed", { channel: "manual" })).toBe(false);
    // Same-status saves are no-ops (the detail resends a record with its own status).
    expect(canTransitionEnrollment("completed", "completed", { channel: "manual" })).toBe(true);
  });

  it("allows the operation edges on the operation channel", () => {
    expect(canTransitionEnrollment("pending", "confirmed")).toBe(true);
    expect(canTransitionEnrollment("pending", "withdrawn")).toBe(true);
    expect(canTransitionEnrollment("confirmed", "completed")).toBe(true);
    expect(canTransitionEnrollment("confirmed", "cancelled")).toBe(true);
    expect(canTransitionEnrollment("withdrawn", "confirmed")).toBe(true);
  });

  it("never regresses a terminal row", () => {
    for (const terminal of ENROLLMENT_TERMINAL_STATUSES) {
      for (const target of ["pending", "confirmed", "withdrawn", "cancelled"] as const) {
        if (terminal === target) continue;
        expect(canTransitionEnrollment(terminal, target)).toBe(false);
        expect(canTransitionEnrollment(terminal, target, { channel: "manual" })).toBe(false);
      }
    }
  });

  it("rejects unknown statuses instead of coercing them", () => {
    expect(canTransitionEnrollment("enrolled", "confirmed")).toBe(false);
    expect(canTransitionEnrollment("pending", "dropped")).toBe(false);
  });
});

describe("allowedEnrollmentTransitions", () => {
  it("offers only the manual edge to the CRUD channel", () => {
    expect(allowedEnrollmentTransitions("pending", { channel: "manual" })).toEqual(["confirmed"]);
    expect(allowedEnrollmentTransitions("confirmed", { channel: "manual" })).toEqual([]);
    expect(allowedEnrollmentTransitions("completed", { channel: "manual" })).toEqual([]);
  });

  it("offers the operation edges to the operations channel", () => {
    expect(allowedEnrollmentTransitions("pending")).toEqual([
      "confirmed",
      "withdrawn",
      "cancelled",
    ]);
    expect(allowedEnrollmentTransitions("confirmed")).toEqual([
      "completed",
      "withdrawn",
      "cancelled",
    ]);
    expect(allowedEnrollmentTransitions("withdrawn")).toEqual(["confirmed"]);
    expect(allowedEnrollmentTransitions("graduated")).toEqual([]);
  });
});

describe("parseEnrollmentStatus", () => {
  it("normalises case and whitespace and rejects unknown values", () => {
    expect(parseEnrollmentStatus(" Confirmed ")).toBe("confirmed");
    expect(parseEnrollmentStatus("withdrawn")).toBe("withdrawn");
    expect(() => parseEnrollmentStatus("enrolled")).toThrow(InvalidEnrollmentStatusError);
    expect(() => parseEnrollmentStatus(undefined)).toThrow(InvalidEnrollmentStatusError);
  });

  it("classifies terminal statuses", () => {
    expect(isEnrollmentTerminal("completed")).toBe(true);
    expect(isEnrollmentTerminal("cancelled")).toBe(true);
    expect(isEnrollmentTerminal("confirmed")).toBe(false);
    expect(isEnrollmentTerminal("pending")).toBe(false);
  });
});

describe("isEnrollmentSuspended", () => {
  const leaves = [
    { fromOn: "2026-02-01", toOn: "2026-02-10", status: "approved" },
    { fromOn: "2026-03-01", toOn: "2026-03-02", status: "pending" },
  ];

  it("reports suspended only for an approved leave covering today", () => {
    expect(isEnrollmentSuspended(leaves, "2026-02-05")).toBe(true);
    expect(isEnrollmentSuspended(leaves, "2026-02-11")).toBe(false);
    // A pending (unapproved) leave does not suspend the enrollment.
    expect(isEnrollmentSuspended(leaves, "2026-03-01")).toBe(false);
  });
});

describe("registration application transitions", () => {
  it("keeps approved and withdrawn immutable", () => {
    expect(allowedApplicationTransitions("approved")).toEqual([]);
    expect(allowedApplicationTransitions("withdrawn")).toEqual([]);
    expect(canTransitionApplication("approved", "waitlisted")).toBe(false);
  });

  it("routes a rejected application back through review", () => {
    expect(canTransitionApplication("rejected", "under_review")).toBe(true);
    expect(canTransitionApplication("rejected", "approved")).toBe(false);
  });

  it("allows the review funnel edges", () => {
    expect(canTransitionApplication("submitted", "waitlisted")).toBe(true);
    expect(canTransitionApplication("submitted", "approved")).toBe(true);
    expect(canTransitionApplication("waitlisted", "approved")).toBe(true);
    expect(canTransitionApplication("waitlisted", "rejected")).toBe(true);
    expect(canTransitionApplication("under_review", "approved")).toBe(true);
  });
});
