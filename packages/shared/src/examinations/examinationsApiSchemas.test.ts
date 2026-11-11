import { describe, expect, it } from "vitest";
import { examsListQuerySchema } from "./examinationsListQuery.js";
import { examBulkWriteSchema } from "./examinationsModuleManifest.js";

/**
 * The examinations HTTP boundary: the list query used to be `.passthrough()` (any key, `status`
 * undeclared) and the bulk upsert used the read DTO as its write body (any date string silently
 * stored as NULL). These pin the strict shapes the routes now enforce.
 */

const validExam = {
  id: "e-1",
  name: "Midterm",
  subject: "Quran",
  totalMarks: 100,
  passingMarks: 50,
  date: "2026-03-10",
  duration: 60,
  classIds: ["c-1"],
  status: "scheduled",
  description: "",
};

describe("examsListQuerySchema", () => {
  it("accepts the directory's filters, including a comma-separated status list", () => {
    const parsed = examsListQuerySchema.safeParse({
      page: "1",
      limit: "25",
      search: "mid",
      status: "upcoming,ongoing",
      includeDeleted: "true",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.limit).toBe(25);
      expect(parsed.data.status).toBe("upcoming,ongoing");
    }
  });

  it("rejects an out-of-range page size, an unknown status and an unknown query key", () => {
    expect(examsListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(examsListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(examsListQuerySchema.safeParse({ status: "upcoming,bogus" }).success).toBe(false);
    expect(examsListQuerySchema.safeParse({ sortField: "createdAt" }).success).toBe(false);
    expect(examsListQuerySchema.safeParse({ unexpected: "1" }).success).toBe(false);
  });

  it("treats an empty status as no filter and accepts the known sort fields", () => {
    expect(examsListQuerySchema.safeParse({ status: "" }).success).toBe(true);
    expect(examsListQuerySchema.safeParse({ sortField: "date", sortDir: "desc" }).success).toBe(
      true,
    );
  });
});

describe("examBulkWriteSchema", () => {
  it("accepts the read-only metadata the list→save round-trip carries", () => {
    const parsed = examBulkWriteSchema.safeParse([
      {
        ...validExam,
        subjectId: "sub-1",
        minAttendancePct: 75,
        resultsFinalizedAt: null,
        deletedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid calendar date instead of letting the persist layer store NULL", () => {
    expect(examBulkWriteSchema.safeParse([{ ...validExam, date: "2026-02-31" }]).success).toBe(
      false,
    );
  });

  it("rejects a blank name, non-positive totals and passing marks above the total", () => {
    expect(examBulkWriteSchema.safeParse([{ ...validExam, name: " " }]).success).toBe(false);
    expect(examBulkWriteSchema.safeParse([{ ...validExam, totalMarks: 0 }]).success).toBe(false);
    expect(examBulkWriteSchema.safeParse([{ ...validExam, passingMarks: 120 }]).success).toBe(
      false,
    );
  });

  it("stays strict about unknown keys", () => {
    expect(examBulkWriteSchema.safeParse([{ ...validExam, unexpected: true }]).success).toBe(false);
  });
});
