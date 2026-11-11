import { describe, expect, it } from "vitest";
import {
  examsFromResponse,
  examsListQuerySchema,
  examsPageResponseSchema,
} from "./examinationsListQuery.js";
import {
  examBulkWriteSchema,
  examMarksWriteSchema,
  examResultModerationResponseSchema,
  examResultPublicSchema,
  examResultRecordSchema,
  examResultsPageResponseSchema,
} from "./examinationsModuleManifest.js";
import { examResultsFinalizationResponseSchema } from "../contracts/examinations.contractEligibility.js";
import { examinationsReportGradeBucketSchema } from "./examinationsReportAggregates.js";
import {
  EXAM_GRADING_SYSTEMS,
  examinationsPreferencesPutBodySchema,
  examinationsPreferencesSchema,
} from "./examinationsSetupPreferences.js";

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
  status: "scheduled" as const,
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

describe("derived list contracts", () => {
  const page = {
    exams: [validExam],
    total: 1,
    page: 1,
    limit: 12,
    hasMore: false,
  };

  it("normalizes the unpaged and paginated envelopes without casting", () => {
    expect(examsFromResponse({ exams: [validExam] })).toHaveLength(1);
    expect(examsFromResponse(page)).toHaveLength(1);
    expect(examsFromResponse(null)).toEqual([]);
  });

  it("keeps the page envelope's keyset continuation optional and typed", () => {
    expect(examsPageResponseSchema.safeParse(page).success).toBe(true);
    expect(examsPageResponseSchema.safeParse({ ...page, nextCursor: "e-1" }).success).toBe(true);
  });

  it("rejects the removed/unknown list params", () => {
    expect(examsListQuerySchema.safeParse({ unknownParam: "1" }).success).toBe(false);
  });
});

describe("result projections", () => {
  const publicResult = {
    id: "r-1",
    examId: "e-1",
    studentId: "s-1",
    marksObtained: 85.5,
  };

  it("derives the staff record from the public projection (internal fields optional)", () => {
    expect(examResultPublicSchema.safeParse(publicResult).success).toBe(true);
    expect(examResultRecordSchema.safeParse(publicResult).success).toBe(true);
    expect(
      examResultRecordSchema.safeParse({ ...publicResult, version: 2, markedBy: "u-1" }).success,
    ).toBe(true);
    expect(examResultRecordSchema.safeParse({ ...publicResult, markedBy: "u-1" }).success).toBe(
      true,
    );
  });

  it("never defaults a missing mark to zero on the read/write boundary", () => {
    expect(
      examMarksWriteSchema.safeParse({ id: "r-1", examId: "e-1", studentId: "s-1" }).success,
    ).toBe(false);
    expect(examMarksWriteSchema.safeParse({ ...publicResult, marksObtained: "85" }).success).toBe(
      false,
    );
  });

  it("parses the marks page and the moderation response", () => {
    expect(
      examResultsPageResponseSchema.safeParse({ results: [publicResult], hasMore: false }).success,
    ).toBe(true);
    expect(
      examResultModerationResponseSchema.safeParse({
        examId: "e-1",
        studentId: "s-1",
        marksObtained: 85.5,
        graceMarks: 2,
        effectiveMarks: 87.5,
        moderationReason: "review",
        moderatedAt: null,
        version: 3,
      }).success,
    ).toBe(true);
  });
});

describe("enum parity in DTOs", () => {
  it("rejects an unknown finalization status", () => {
    expect(
      examResultsFinalizationResponseSchema.safeParse({
        examId: "e-1",
        resultsFinalizedAt: null,
        status: "postponed",
      }).success,
    ).toBe(false);
    expect(
      examResultsFinalizationResponseSchema.safeParse({
        examId: "e-1",
        resultsFinalizedAt: null,
        status: "completed",
      }).success,
    ).toBe(true);
  });

  it("rejects a grade bucket outside the shared letter scale", () => {
    expect(examinationsReportGradeBucketSchema.safeParse({ grade: "E", count: 1 }).success).toBe(
      false,
    );
    expect(examinationsReportGradeBucketSchema.safeParse({ grade: "A+", count: 1 }).success).toBe(
      true,
    );
  });
});

describe("preferences contract", () => {
  const valid = {
    passMark: "50",
    maxMark: "100",
    gradingSystem: "percentage",
    showRankings: true,
    allowRetake: true,
    autoPublishResults: false,
    notifyOnResult: true,
    certificateTemplate: "default",
    aiGrading: false,
    distinguishHonours: true,
    examReminders: true,
    defaultViewLayout: "list",
  };

  it("accepts every advertised grading system and rejects unknown ones", () => {
    for (const gradingSystem of EXAM_GRADING_SYSTEMS) {
      expect(examinationsPreferencesSchema.safeParse({ ...valid, gradingSystem }).success).toBe(
        true,
      );
    }
    expect(
      examinationsPreferencesSchema.safeParse({ ...valid, gradingSystem: "percent" }).success,
    ).toBe(false);
  });

  it("keeps the PUT body partial but strict", () => {
    expect(
      examinationsPreferencesPutBodySchema.safeParse({ gradingSystem: "letter" }).success,
    ).toBe(true);
    expect(examinationsPreferencesPutBodySchema.safeParse({ unexpected: true }).success).toBe(
      false,
    );
    expect(
      examinationsPreferencesPutBodySchema.safeParse({ gradingSystem: "percent" }).success,
    ).toBe(false);
  });
});
