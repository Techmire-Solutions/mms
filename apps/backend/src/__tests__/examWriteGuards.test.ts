import { describe, expect, it } from "vitest";
import {
  assertExamDeletable,
  assertExamNotArchived,
  assertExamTransitionAllowed,
  assertPublishedExamImmutable,
  type ExamWriteIntent,
  type ExamWriteState,
} from "../examinations/domain/examWriteGuards.js";

/**
 * The pure write guards had no direct spec — their behaviour was only implied by repository/DB
 * suites. These pin the state-machine edges: illegal transitions, archived immutability and the
 * published scoring-frame freeze.
 */

const EXAM = "ex-1";

function state(overrides: Partial<ExamWriteState> = {}): ExamWriteState {
  return {
    status: "ongoing",
    resultsFinalizedAt: null,
    deletedAt: null,
    name: "Midterm",
    subjectId: "sub-1",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-03-10",
    duration: 90,
    classIds: ["class-1"],
    ...overrides,
  };
}

function intent(overrides: Partial<ExamWriteIntent> = {}): ExamWriteIntent {
  return {
    status: "ongoing",
    subjectId: "sub-1",
    name: "Midterm",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-03-10",
    duration: 90,
    classIds: ["class-1"],
    ...overrides,
  };
}

describe("assertExamTransitionAllowed", () => {
  it("allows any valid status when creating a row", () => {
    for (const status of ["upcoming", "scheduled", "ongoing", "completed", "cancelled"]) {
      expect(() => assertExamTransitionAllowed(null, status)).not.toThrow();
    }
  });

  it("allows the legal forward moves and a same-state update", () => {
    expect(() => assertExamTransitionAllowed({ status: "upcoming" }, "scheduled")).not.toThrow();
    expect(() => assertExamTransitionAllowed({ status: "upcoming" }, "ongoing")).not.toThrow();
    expect(() => assertExamTransitionAllowed({ status: "ongoing" }, "completed")).not.toThrow();
    expect(() => assertExamTransitionAllowed({ status: "ongoing" }, "ongoing")).not.toThrow();
  });

  it("rejects an illegal move with 409 illegal_exam_transition", () => {
    expect(() => assertExamTransitionAllowed({ status: "upcoming" }, "completed")).toThrowError(
      expect.objectContaining({ statusCode: 409, type: "illegal_exam_transition" }),
    );
    expect(() => assertExamTransitionAllowed({ status: "completed" }, "ongoing")).toThrowError(
      expect.objectContaining({ statusCode: 409, type: "illegal_exam_transition" }),
    );
  });

  it("fails closed on an unknown or corrupt persisted status", () => {
    expect(() => assertExamTransitionAllowed({ status: "archived-ish" }, "ongoing")).toThrowError(
      expect.objectContaining({ type: "illegal_exam_transition" }),
    );
  });
});

describe("assertExamNotArchived", () => {
  it("refuses to edit a trashed exam until it is restored", () => {
    expect(() => assertExamNotArchived(EXAM, state({ deletedAt: new Date() }))).toThrowError(
      expect.objectContaining({ statusCode: 409, type: "exam_archived" }),
    );
  });

  it("is a no-op for an active exam", () => {
    expect(() => assertExamNotArchived(EXAM, state())).not.toThrow();
  });
});

describe("assertPublishedExamImmutable", () => {
  const published = () => state({ resultsFinalizedAt: new Date("2026-03-01T00:00:00Z") });

  it("is a no-op while results are unpublished", () => {
    expect(() =>
      assertPublishedExamImmutable(EXAM, state(), intent({ totalMarks: 1 })),
    ).not.toThrow();
  });

  it.each([
    ["name", { name: "Renamed" }],
    ["subject", { subjectId: "sub-2" }],
    ["total marks", { totalMarks: 120 }],
    ["passing marks", { passingMarks: 60 }],
    ["date", { date: "2026-04-01" }],
    ["duration", { duration: 120 }],
    ["status", { status: "cancelled" }],
  ] as const)("rejects a published %s change", (_label, change) => {
    expect(() => assertPublishedExamImmutable(EXAM, published(), intent(change))).toThrowError(
      expect.objectContaining({ statusCode: 409, type: "exam_published_immutable" }),
    );
  });

  it("rejects a published class-membership change but ignores its order", () => {
    expect(() =>
      assertPublishedExamImmutable(EXAM, published(), intent({ classIds: ["class-2"] })),
    ).toThrowError(expect.objectContaining({ type: "exam_published_immutable" }));
    expect(() =>
      assertPublishedExamImmutable(
        EXAM,
        state({ resultsFinalizedAt: new Date(), classIds: ["a", "b"] }),
        intent({ classIds: ["b", "a"] }),
      ),
    ).not.toThrow();
  });

  it("allows a description-only note on a published exam", () => {
    // `description` is intentionally outside the guarded intent; the guard must ignore it.
    const withNote = { ...intent(), description: "note" } as ExamWriteIntent;
    expect(() => assertPublishedExamImmutable(EXAM, published(), withNote)).not.toThrow();
  });
});

describe("assertExamDeletable", () => {
  it("requires an unlock before trashing published results", () => {
    expect(() => assertExamDeletable(EXAM, { resultsFinalizedAt: new Date() })).toThrowError(
      expect.objectContaining({ statusCode: 409, type: "unpublish_first" }),
    );
    expect(() => assertExamDeletable(EXAM, { resultsFinalizedAt: null })).not.toThrow();
  });
});
