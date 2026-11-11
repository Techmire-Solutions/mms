import { describe, expect, it } from "vitest";
import {
  EXAM_STATUSES,
  EXAM_STATUS_TRANSITIONS,
  allowedNextStatuses,
  canTransitionExam,
  isExamLocked,
  isExamPublished,
  isExamStatus,
} from "./examLifecycle.js";

describe("exam lifecycle state machine", () => {
  it("declares exactly the statuses the database constraint allows", () => {
    expect([...EXAM_STATUSES]).toEqual([
      "upcoming",
      "scheduled",
      "ongoing",
      "completed",
      "cancelled",
    ]);
    expect(isExamStatus("ongoing")).toBe(true);
    expect(isExamStatus("draft")).toBe(false);
    expect(isExamStatus(undefined)).toBe(false);
  });

  it("allows only the documented forward moves", () => {
    expect(canTransitionExam("upcoming", "scheduled")).toBe(true);
    expect(canTransitionExam("upcoming", "ongoing")).toBe(true);
    expect(canTransitionExam("scheduled", "ongoing")).toBe(true);
    expect(canTransitionExam("ongoing", "completed")).toBe(true);
    expect(canTransitionExam("upcoming", "cancelled")).toBe(true);

    // Skipping the intermediate state and rewinding are both illegal.
    expect(canTransitionExam("upcoming", "completed")).toBe(false);
    expect(canTransitionExam("completed", "ongoing")).toBe(false);
    expect(canTransitionExam("ongoing", "upcoming")).toBe(false);
  });

  it("treats a no-op as an update, not a transition", () => {
    for (const status of EXAM_STATUSES) {
      expect(canTransitionExam(status, status)).toBe(true);
    }
  });

  it("keeps completed and cancelled terminal", () => {
    expect(EXAM_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(EXAM_STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(allowedNextStatuses("completed")).toEqual([]);
    expect(allowedNextStatuses("cancelled")).toEqual([]);
  });

  it("fails closed on unknown or missing state", () => {
    expect(canTransitionExam("completed", "archived")).toBe(false);
    expect(canTransitionExam("draft", "ongoing")).toBe(false);
    expect(canTransitionExam(undefined, "ongoing")).toBe(true); // create: any valid status
    expect(canTransitionExam("ongoing", undefined)).toBe(false);
    expect(allowedNextStatuses("not-a-status")).toEqual([]);
    expect(allowedNextStatuses(null)).toEqual([]);
  });

  it("derives publication and lock state from the stamp, not the status", () => {
    expect(isExamPublished({ resultsFinalizedAt: "2026-03-01T00:00:00.000Z" })).toBe(true);
    expect(isExamPublished({ resultsFinalizedAt: null })).toBe(false);
    expect(isExamPublished({})).toBe(false);

    expect(
      isExamLocked({ status: "ongoing", resultsFinalizedAt: "2026-03-01T00:00:00.000Z" }),
    ).toBe(true);
    expect(isExamLocked({ status: "cancelled", resultsFinalizedAt: null })).toBe(true);
    expect(isExamLocked({ status: "ongoing", resultsFinalizedAt: null })).toBe(false);
  });
});
