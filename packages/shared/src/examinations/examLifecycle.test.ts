import { describe, expect, it } from "vitest";
import {
  EXAM_STATUSES,
  EXAM_STATUS_TRANSITIONS,
  PUBLISHABLE_EXAM_STATUSES,
  PUBLISH_TARGET_STATUS,
  UNPUBLISH_TARGET_STATUS,
  allowedNextStatuses,
  canTransitionExam,
  isExamArchived,
  isExamLocked,
  isExamPublished,
  isExamStatus,
  isPublishableExamStatus,
  publishExamRejection,
  unpublishExamRejection,
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

  it("matches the transition table for every ordered status pair", () => {
    for (const from of EXAM_STATUSES) {
      for (const to of EXAM_STATUSES) {
        const expected =
          from === to || (EXAM_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
        expect(canTransitionExam(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
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

describe("administrative publication layer", () => {
  it("publishes only an exam that has been sat", () => {
    // An upcoming/scheduled exam cannot have final results; the generic table already refuses
    // upcoming -> completed, so the administrative path must not sneak around it.
    expect(publishExamRejection({ status: "upcoming" })).toBe("not_sat");
    expect(publishExamRejection({ status: "scheduled" })).toBe("not_sat");
    expect(publishExamRejection({ status: "ongoing" })).toBeNull();
    expect(publishExamRejection({ status: "completed" })).toBeNull();
    expect([...PUBLISHABLE_EXAM_STATUSES]).toEqual(["ongoing", "completed"]);
    expect(isPublishableExamStatus("ongoing")).toBe(true);
    expect(isPublishableExamStatus("upcoming")).toBe(false);
  });

  it("refuses to publish an archived, cancelled or already-published exam", () => {
    expect(publishExamRejection({ status: "ongoing", deletedAt: "2026-03-01T00:00:00.000Z" })).toBe(
      "archived",
    );
    expect(publishExamRejection({ status: "cancelled" })).toBe("cancelled");
    expect(
      publishExamRejection({
        status: "completed",
        resultsFinalizedAt: "2026-03-01T00:00:00.000Z",
      }),
    ).toBe("already_published");
    // Archived wins over the other reasons: the operator is told to restore first.
    expect(
      publishExamRejection({
        status: "cancelled",
        deletedAt: "2026-03-01T00:00:00.000Z",
        resultsFinalizedAt: "2026-03-01T00:00:00.000Z",
      }),
    ).toBe("archived");
  });

  it("unlocks only a published, non-archived exam", () => {
    expect(unpublishExamRejection({ status: "ongoing" })).toBe("not_published");
    expect(unpublishExamRejection({ status: "cancelled" })).toBe("not_published");
    expect(
      unpublishExamRejection({
        status: "completed",
        resultsFinalizedAt: "2026-03-01T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      unpublishExamRejection({
        status: "completed",
        resultsFinalizedAt: "2026-03-01T00:00:00.000Z",
        deletedAt: "2026-03-01T00:00:00.000Z",
      }),
    ).toBe("archived");
  });

  it("declares the target statuses the use cases write", () => {
    expect(PUBLISH_TARGET_STATUS).toBe("completed");
    // The unlock must rewind delivery so an unpublished exam cannot read as finalized (F8).
    expect(UNPUBLISH_TARGET_STATUS).toBe("ongoing");
    expect(canTransitionExam("completed", UNPUBLISH_TARGET_STATUS)).toBe(false);
  });

  it("detects the archive separately from publication and status", () => {
    expect(isExamArchived({ deletedAt: null })).toBe(false);
    expect(isExamArchived({})).toBe(false);
    expect(isExamArchived({ deletedAt: "2026-03-01T00:00:00.000Z" })).toBe(true);
  });
});
