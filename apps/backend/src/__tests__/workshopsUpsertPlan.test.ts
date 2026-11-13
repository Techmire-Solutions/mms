import { describe, it, expect } from "vitest";
import { planAttendanceMarks, planScoreLines } from "../db/repositories/workshopUpsertPlanning.js";

/**
 * The rules that keep concurrent workshop check-in / score saves safe are pure functions, so they
 * are pinned here without a database. The real-Postgres suite covers the SQL side.
 *
 * Two failure modes this planner removes:
 *  - a repeated participant (or participant+criterion) in one payload → `21000`
 *    ("ON CONFLICT DO UPDATE command cannot affect row a second time") → HTTP 500;
 *  - two saves in different orders taking the conflict row locks in opposite order → `40P01`.
 */

describe("planAttendanceMarks", () => {
  it("collapses a participant marked twice in one payload, keeping the last mark", () => {
    const marks = planAttendanceMarks([
      { participantId: "p-1", status: "absent" },
      { participantId: "p-1", status: "present" },
    ]);

    expect(marks).toHaveLength(1);
    expect(marks[0]).toEqual({ participantId: "p-1", status: "present" });
  });

  it("orders marks by participant id so concurrent saves take the same locks in the same order", () => {
    const marks = planAttendanceMarks([
      { participantId: "p-3", status: "present" },
      { participantId: "p-1", status: "present" },
      { participantId: "p-2", status: "late" },
    ]);

    expect(marks.map((mark) => mark.participantId)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("keeps distinct participants and their statuses untouched", () => {
    const marks = planAttendanceMarks([
      { participantId: "p-1", status: "excused" },
      { participantId: "p-2", status: "absent" },
    ]);

    expect(marks).toEqual([
      { participantId: "p-1", status: "excused" },
      { participantId: "p-2", status: "absent" },
    ]);
  });
});

describe("planScoreLines", () => {
  const line = (overrides: Record<string, unknown> = {}) => ({
    participantId: "p-1",
    criterionName: "Practical",
    score: 7,
    maxScore: 10,
    ...overrides,
  });

  it("collapses a repeated (participant, criterion) key, keeping the last line", () => {
    const lines = planScoreLines([line({ score: 5 }), line({ score: 9, remarks: "improved" })]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ participantId: "p-1", criterionName: "Practical", score: 9 });
    expect(lines[0]?.remarks).toBe("improved");
  });

  it("keeps different criteria of the same participant", () => {
    const lines = planScoreLines([
      line({ criterionName: "Practical", score: 7 }),
      line({ criterionName: "Theory", score: 8 }),
    ]);

    expect(lines.map((entry) => entry.criterionName)).toEqual(["Practical", "Theory"]);
  });

  it("orders by participant then criterion so concurrent saves cannot deadlock", () => {
    const lines = planScoreLines([
      line({ participantId: "p-2", criterionName: "Theory" }),
      line({ participantId: "p-1", criterionName: "Theory" }),
      line({ participantId: "p-2", criterionName: "Practical" }),
      line({ participantId: "p-1", criterionName: "Practical" }),
    ]);

    expect(lines.map((entry) => `${entry.participantId}/${entry.criterionName}`)).toEqual([
      "p-1/Practical",
      "p-1/Theory",
      "p-2/Practical",
      "p-2/Theory",
    ]);
  });

  it("normalizes an omitted remark to null", () => {
    const lines = planScoreLines([line()]);
    expect(lines[0]?.remarks).toBeNull();
  });
});
