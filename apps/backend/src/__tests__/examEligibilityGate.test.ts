import { beforeEach, describe, expect, it, vi } from "vitest";

const eligibility = vi.hoisted(() => ({
  loadExamEligibilityBatch: vi.fn(),
}));

vi.mock("../examinations/repository/examEligibilityAdapter.js", () => ({
  examEligibilityRepository: eligibility,
}));

vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: {
    loadExamsByIds: vi.fn(),
  },
}));

vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, getRequestTenant: () => "demo" };
});

const { assertExamResultsEligible } =
  await import("../examinations/use-cases/examEligibilityGate.js");
const { examinationsUseCases } = await import("../examinations/use-cases/examinationsUseCases.js");

const ADMIN = { id: "u-1", role: "admin" } as never;

function row(state: "eligible" | "blocked" | "unknown", studentId: string) {
  return {
    studentId,
    studentName: studentId,
    classId: "c-1",
    state,
    attendancePct: state === "unknown" ? null : state === "blocked" ? 40 : 90,
    requiredPct: 75,
    overridden: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(examinationsUseCases.loadExamsByIds).mockResolvedValue([
    { id: "ex-1", totalMarks: 100, passingMarks: 50, classIds: ["c-1"] },
    { id: "ex-2", totalMarks: 100, passingMarks: 50, classIds: ["c-1"] },
  ] as never);
});

describe("exam eligibility gate (batched)", () => {
  it("reads eligibility once for a multi-exam batch", async () => {
    eligibility.loadExamEligibilityBatch.mockResolvedValue(
      new Map([
        ["ex-1", { examId: "ex-1", requiredPct: 75, rows: [row("eligible", "s-1")] }],
        ["ex-2", { examId: "ex-2", requiredPct: null, rows: [row("eligible", "s-1")] }],
      ]),
    );

    await expect(
      assertExamResultsEligible(ADMIN, [
        { id: "r1", examId: "ex-1", studentId: "s-1", marksObtained: 80 },
        { id: "r2", examId: "ex-2", studentId: "s-1", marksObtained: 81 },
      ] as never),
    ).resolves.toBeUndefined();

    expect(eligibility.loadExamEligibilityBatch).toHaveBeenCalledTimes(1);
    expect(eligibility.loadExamEligibilityBatch).toHaveBeenCalledWith("demo", ["ex-1", "ex-2"]);
  });

  it("rejects a student who is not on the seat-holding roster (was a silent skip)", async () => {
    eligibility.loadExamEligibilityBatch.mockResolvedValue(
      new Map([["ex-1", { examId: "ex-1", requiredPct: 75, rows: [row("eligible", "s-1")] }]]),
    );

    await expect(
      assertExamResultsEligible(ADMIN, [
        { id: "r1", examId: "ex-1", studentId: "withdrawn-student", marksObtained: 80 },
      ] as never),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_student_not_enrolled" });
  });

  it("still blocks an ineligible student and reports unknown attendance", async () => {
    eligibility.loadExamEligibilityBatch.mockResolvedValueOnce(
      new Map([["ex-1", { examId: "ex-1", requiredPct: 75, rows: [row("blocked", "s-1")] }]]),
    );
    await expect(
      assertExamResultsEligible(ADMIN, [
        { id: "r1", examId: "ex-1", studentId: "s-1", marksObtained: 80 },
      ] as never),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_eligibility_blocked" });

    eligibility.loadExamEligibilityBatch.mockResolvedValueOnce(
      new Map([["ex-1", { examId: "ex-1", requiredPct: 75, rows: [row("unknown", "s-1")] }]]),
    );
    await expect(
      assertExamResultsEligible(ADMIN, [
        { id: "r1", examId: "ex-1", studentId: "s-1", marksObtained: 80 },
      ] as never),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_eligibility_unknown" });
  });

  it("keeps the marks-range check before touching the roster", async () => {
    eligibility.loadExamEligibilityBatch.mockResolvedValue(
      new Map([["ex-1", { examId: "ex-1", requiredPct: null, rows: [row("eligible", "s-1")] }]]),
    );
    await expect(
      assertExamResultsEligible(ADMIN, [
        { id: "r1", examId: "ex-1", studentId: "s-1", marksObtained: 120 },
      ] as never),
    ).rejects.toMatchObject({ statusCode: 400, type: "exam_marks_out_of_range" });
  });
});
