import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Matrix export service: chunked reads (no full-matrix materialisation), one header, footer totals,
 * and the XLSX cell budget.
 */

const mocks = vi.hoisted(() => ({
  students: vi.fn(),
  marks: vi.fn(),
}));

vi.mock("../db/repositories/attendanceMatrixRepository.js", () => ({
  listMatrixStudentsPage: mocks.students,
  listMatrixMarks: mocks.marks,
  countMatrixStudents: vi.fn(),
}));
vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));

const { generateAttendanceMatrixCsv, assertMatrixCellBudget } =
  await import("../services/attendanceMatrixExportService.js");

const REQUEST = { classId: "cls-1", dateFrom: "2026-03-01", dateTo: "2026-03-03" };
const META = { tenant: "demo" };

function studentPage(ids: string[], hasMore = false, nextCursor?: string) {
  return {
    students: ids.map((id) => ({ studentId: id, studentName: `Student ${id}`, rollNo: id })),
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.marks.mockResolvedValue([]);
});

describe("generateAttendanceMatrixCsv", () => {
  it("streams the roster in chunks and emits the header once", async () => {
    mocks.students
      .mockResolvedValueOnce(studentPage(["s1", "s2"], true, "s2"))
      .mockResolvedValueOnce(studentPage(["s3"], false));
    mocks.marks.mockResolvedValue([
      { studentId: "s1", date: "2026-03-01", status: "present" },
      { studentId: "s3", date: "2026-03-02", status: "absent" },
    ]);

    const generator = generateAttendanceMatrixCsv(REQUEST, META);
    const chunks: string[] = [];
    let done = false;
    while (!done) {
      const step = await generator.next();
      done = step.done ?? false;
      if (!done && typeof step.value === "string") chunks.push(step.value);
    }

    // Two roster pages → two student chunks + footer.
    expect(mocks.students).toHaveBeenCalledTimes(2);
    // The header row appears once, in the first chunk.
    const body = chunks.join("");
    expect(body.match(/Roll No/g)?.length).toBe(1);
    expect(body).toContain("Student s1");
    expect(body).toContain("Student s3");
    expect(body).toContain("Daily totals");
    // Second page asked with the cursor from the first.
    expect(mocks.students).toHaveBeenLastCalledWith(
      "demo",
      expect.objectContaining({ afterStudentId: "s2" }),
    );
  });

  it("returns the exported student count and totals", async () => {
    mocks.students.mockResolvedValueOnce(studentPage(["s1"], false));
    mocks.marks.mockResolvedValue([{ studentId: "s1", date: "2026-03-01", status: "late" }]);

    const generator = generateAttendanceMatrixCsv(REQUEST, META);
    let step = await generator.next();
    while (!step.done) step = await generator.next();

    expect(step.value).toEqual({
      students: 1,
      totals: { present: 0, late: 1, absent: 0, excused: 0, marked: 1 },
    });
  });

  it("rejects a range longer than the cap before reading anything", async () => {
    const generator = generateAttendanceMatrixCsv(
      { classId: "cls-1", dateFrom: "2026-01-01", dateTo: "2026-12-31" },
      META,
    );
    await expect(generator.next()).rejects.toThrow(/92 days/);
    expect(mocks.students).not.toHaveBeenCalled();
  });
});

describe("assertMatrixCellBudget", () => {
  it("allows a matrix inside the cell budget", () => {
    expect(() => assertMatrixCellBudget(["2026-03-01"], 100)).not.toThrow();
  });

  it("refuses a matrix that would need too many cells", () => {
    expect(() =>
      assertMatrixCellBudget(
        Array.from({ length: 92 }, () => "2026-03-01"),
        5000,
      ),
    ).toThrow(/cells/);
    try {
      assertMatrixCellBudget(
        Array.from({ length: 92 }, () => "2026-03-01"),
        5000,
      );
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 413, type: "payload_too_large" });
    }
  });
});
