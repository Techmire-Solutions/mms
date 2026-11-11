import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { loadExaminationsReportAggregatesSql } from "../../db/repositories/examinationRepositoryReport.js";
import { loadExamRoster } from "../../db/repositories/examEligibilityRepository.js";
import {
  auditTrailEvents,
  enrollments,
  examClasses,
  examEligibilityOverrides,
  examResults,
  exams,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import {
  applyExamResultModeration,
  listExamResultsPage,
  replaceExamResultsForWorkspace,
  saveExamResult,
} from "../../db/repositories/examinationResultsRepository.js";
import {
  grantEligibilityOverride,
  revokeEligibilityOverride,
} from "../../db/repositories/examEligibilityRepository.js";
import {
  bulkRestoreExams,
  bulkSoftDeleteExams,
  saveExam,
} from "../../db/repositories/examinationExamsRepository.js";
import {
  loadExamEligibility,
  loadExamEligibilityBatch,
  setExamAttendanceGate,
} from "../../db/repositories/examEligibilityRepository.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { cascadeSoftDeleteEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";
import { extractPgErrorCode, requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the specialized examination subsystems
 * (docs/examinations-specialized-subsystems-audit-2026-11-11.md):
 *   - the attendance gate keeps its decimals (smallint silently rounded 74.5 → 75);
 *   - the eligibility batch returns one view per exam from one roster rule;
 *   - a withdrawn enrollment is not on the roster;
 *   - grace marks are bounded by the exam total, preserve the raw mark, and are refused once
 *     results are published;
 *   - changing an exam's scoring frame is audited.
 */

const TENANT = "exam-sub-test";
const SESSION = "ses-sub";
const CLASS = "cls-sub";
const EXAM = "ex-sub";
const EXAM_B = "ex-sub-b";
const STUDENT = "stu-sub-1";
const WITHDRAWN = "stu-sub-2";

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Exam Subsystems" })
      .onConflictDoNothing();
    await tx.tx.insert(students).values([
      { id: STUDENT, workspaceSubdomain: TENANT, grNumber: "gr-sub-1", status: "active" },
      { id: WITHDRAWN, workspaceSubdomain: TENANT, grNumber: "gr-sub-2", status: "active" },
    ]);
    await tx.tx
      .insert(sessions)
      .values({ id: SESSION, workspaceSubdomain: TENANT, name: "Session" });
    await tx.tx
      .insert(sessionClasses)
      .values({ id: CLASS, workspaceSubdomain: TENANT, sessionId: SESSION, name: "Class" });
    await tx.tx.insert(enrollments).values([
      {
        id: "enr-sub-1",
        workspaceSubdomain: TENANT,
        studentId: STUDENT,
        sessionId: SESSION,
        classId: CLASS,
        status: "confirmed",
      },
      {
        id: "enr-sub-2",
        workspaceSubdomain: TENANT,
        studentId: WITHDRAWN,
        sessionId: SESSION,
        classId: CLASS,
        status: "withdrawn",
      },
    ]);
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function resetExamState(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
    await tx.insert(exams).values([
      {
        id: EXAM,
        workspaceSubdomain: TENANT,
        name: "Midterm",
        totalMarks: 100,
        passingMarks: 50,
        date: "2026-03-10",
        duration: 60,
        status: "ongoing",
      },
      {
        id: EXAM_B,
        workspaceSubdomain: TENANT,
        name: "Final",
        totalMarks: 100,
        passingMarks: 50,
        date: "2026-06-10",
        duration: 60,
        status: "ongoing",
      },
    ]);
    await tx.insert(examClasses).values([
      { workspaceSubdomain: TENANT, examId: EXAM, classId: CLASS },
      { workspaceSubdomain: TENANT, examId: EXAM_B, classId: CLASS },
    ]);
  });
}

async function markRow(examId = EXAM) {
  return withTenant(TENANT, async (tx) => {
    const [row] = await tx
      .select({
        marksObtained: examResults.marksObtained,
        graceMarks: examResults.graceMarks,
        moderationReason: examResults.moderationReason,
        version: examResults.version,
      })
      .from(examResults)
      .where(and(eq(examResults.workspaceSubdomain, TENANT), eq(examResults.examId, examId)));
    return row;
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
}, 120_000);

beforeEach(async () => {
  await resetExamState();
});

afterAll(async () => {
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx
      .delete(auditTrailEvents)
      .where(eq(auditTrailEvents.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(examResults).where(eq(examResults.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(exams).where(eq(exams.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await cleanup.commit();
  } catch {
    await cleanup.rollback().catch(() => undefined);
  }
  await closeDatabase();
});

describe("attendance gate precision", () => {
  it("round-trips a one-decimal threshold instead of silently rounding it", async () => {
    await setExamAttendanceGate(TENANT, {
      examId: EXAM,
      minAttendancePct: 74.5,
      actorId: "u-sub",
    });

    const view = await loadExamEligibility(TENANT, EXAM);
    expect(view.requiredPct).toBe(74.5);

    const stored = await withTenant(TENANT, async (tx) => {
      const [row] = await tx
        .select({ minAttendancePct: exams.minAttendancePct })
        .from(exams)
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM)));
      return Number(row?.minAttendancePct);
    });
    expect(stored).toBe(74.5);
  });
});

describe("eligibility batch", () => {
  it("returns one view per exam from a single seat-holding roster", async () => {
    await setExamAttendanceGate(TENANT, { examId: EXAM, minAttendancePct: 75, actorId: "u-sub" });

    const batch = await loadExamEligibilityBatch(TENANT, [EXAM, EXAM_B]);
    expect([...batch.keys()].sort()).toEqual([EXAM, EXAM_B].sort());
    expect(batch.get(EXAM)?.requiredPct).toBe(75);
    expect(batch.get(EXAM_B)?.requiredPct).toBeNull();

    const roster = batch.get(EXAM)?.rows ?? [];
    expect(roster).toHaveLength(1);
    expect(roster[0]?.studentId).toBe(STUDENT);
    // Both exams share the class/enrollment window: the grouped attendance aggregate must produce
    // the same roster for each exam.
    expect(batch.get(EXAM_B)?.rows.map((row) => row.studentId)).toEqual([STUDENT]);
    // Withdrawn enrollments are not on the roster — the grid and the gate now agree.
    expect(roster.some((row) => row.studentId === WITHDRAWN)).toBe(false);
  });

  it("reports a student with no attendance as unknown, not eligible", async () => {
    await setExamAttendanceGate(TENANT, { examId: EXAM, minAttendancePct: 75, actorId: "u-sub" });
    const view = await loadExamEligibility(TENANT, EXAM);
    expect(view.rows[0]?.state).toBe("unknown");
  });

  it("applies the strictest non-zero session threshold to a multi-session exam", async () => {
    const sessionB = "ses-sub-b";
    const classB = "cls-sub-b";
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .update(sessions)
        .set({ minAttendancePct: 60 })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION)));
      await tx.insert(sessions).values({
        id: sessionB,
        workspaceSubdomain: TENANT,
        name: "Session B",
        minAttendancePct: 75,
      });
      await tx.insert(sessionClasses).values({
        id: classB,
        workspaceSubdomain: TENANT,
        sessionId: sessionB,
        name: "Class B",
      });
      await tx.insert(examClasses).values({
        workspaceSubdomain: TENANT,
        examId: EXAM,
        classId: classB,
      });
    });

    // The exam has no threshold of its own: the stricter session (75) must win, not MIN(60, 75).
    expect((await loadExamEligibility(TENANT, EXAM)).requiredPct).toBe(75);

    // A session that disables its gate (0) must not dilute the strictest requirement.
    await withTenant(TENANT, (tx) =>
      tx
        .update(sessions)
        .set({ minAttendancePct: 0 })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION))),
    );
    expect((await loadExamEligibility(TENANT, EXAM)).requiredPct).toBe(75);

    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .delete(examClasses)
        .where(
          and(
            eq(examClasses.workspaceSubdomain, TENANT),
            eq(examClasses.examId, EXAM),
            eq(examClasses.classId, classB),
          ),
        );
      await tx
        .delete(sessionClasses)
        .where(and(eq(sessionClasses.workspaceSubdomain, TENANT), eq(sessionClasses.id, classB)));
      await tx
        .delete(sessions)
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, sessionB)));
      await tx
        .update(sessions)
        .set({ minAttendancePct: null })
        .where(and(eq(sessions.workspaceSubdomain, TENANT), eq(sessions.id, SESSION)));
    });
  });
});

describe("grace marks", () => {
  it("adds grace without rewriting the raw mark, and audits the change", async () => {
    await saveExamResult(TENANT, {
      id: "er-sub-1",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 48,
      markedBy: "u-sub",
    });

    const moderated = await applyExamResultModeration(TENANT, {
      examId: EXAM,
      studentId: STUDENT,
      graceMarks: 2,
      reason: "borderline script re-marked by two examiners",
      actorId: "u-moderator",
      version: 1,
    });

    expect(moderated.marksObtained).toBe(48);
    expect(moderated.graceMarks).toBe(2);
    expect(moderated.effectiveMarks).toBe(50);

    const row = await markRow();
    expect(Number(row?.marksObtained)).toBe(48);
    expect(Number(row?.graceMarks)).toBe(2);
    expect(row?.version).toBe(2);

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ recordId: auditTrailEvents.recordId })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exam_results"),
          ),
        ),
    );
    expect(events.some((event) => event.recordId === "er-sub-1")).toBe(true);
  });

  it("refuses grace that would push the effective score past the exam total", async () => {
    await saveExamResult(TENANT, {
      id: "er-sub-2",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 98,
      markedBy: "u-sub",
    });

    await expect(
      applyExamResultModeration(TENANT, {
        examId: EXAM,
        studentId: STUDENT,
        graceMarks: 5,
        reason: "too much grace",
        actorId: "u-moderator",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Number((await markRow())?.graceMarks)).toBe(0);
  });

  it("refuses moderation once results are published and for an archived exam", async () => {
    await saveExamResult(TENANT, {
      id: "er-sub-3",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 70,
      markedBy: "u-sub",
    });
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ resultsFinalizedAt: new Date(), status: "completed" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );

    await expect(
      applyExamResultModeration(TENANT, {
        examId: EXAM,
        studentId: STUDENT,
        graceMarks: 2,
        reason: "late review",
        actorId: "u-moderator",
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_results_finalized" });

    await resetExamState();
    await saveExamResult(TENANT, {
      id: "er-sub-4",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 70,
      markedBy: "u-sub",
    });
    await bulkSoftDeleteExams(TENANT, [EXAM], "u-sub", "duplicate");
    await expect(
      applyExamResultModeration(TENANT, {
        examId: EXAM,
        studentId: STUDENT,
        graceMarks: 2,
        reason: "late review",
        actorId: "u-moderator",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an effective score above the total at the database as a backstop", async () => {
    await saveExamResult(TENANT, {
      id: "er-sub-5",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 90,
      markedBy: "u-sub",
    });

    let code: string | undefined;
    try {
      await withTenant(TENANT, (tx) =>
        tx
          .update(examResults)
          .set({ graceMarks: 20 })
          .where(and(eq(examResults.workspaceSubdomain, TENANT), eq(examResults.examId, EXAM))),
      );
    } catch (error) {
      code = extractPgErrorCode(error);
    }
    expect(code).toBe("23514");
  });
});

describe("publication-aware marks read", () => {
  it("hides unpublished marks from read-only audiences", async () => {
    await saveExamResult(TENANT, {
      id: "er-pub-1",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 60,
      markedBy: "u-sub",
    });
    await saveExamResult(TENANT, {
      id: "er-pub-2",
      examId: EXAM_B,
      studentId: STUDENT,
      marksObtained: 70,
      markedBy: "u-sub",
    });
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ resultsFinalizedAt: new Date(), status: "completed" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );

    const all = await listExamResultsPage(TENANT, {});
    expect(all.results).toHaveLength(2);

    const published = await listExamResultsPage(TENANT, { publishedOnly: true });
    expect(published.results.map((row) => row.id)).toEqual(["er-pub-1"]);
  });
});

describe("scoring-frame audit", () => {
  it("audits a total-marks change that re-grades every student", async () => {
    await saveExam(TENANT, {
      id: EXAM,
      name: "Midterm",
      subject: "Quran",
      date: "2026-03-10",
      duration: 60,
      totalMarks: 120,
      passingMarks: 50,
      classIds: [CLASS],
      status: "ongoing",
      description: "",
    });

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ recordId: auditTrailEvents.recordId, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exams"),
            eq(auditTrailEvents.recordId, EXAM),
          ),
        ),
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.newState?.includes("120"))).toBe(true);
  });
});

describe("cancelled exams are closed", () => {
  it("refuses mark entry and moderation on a cancelled sitting", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ status: "cancelled" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );

    await expect(
      saveExamResult(TENANT, {
        id: "er-cancelled",
        examId: EXAM,
        studentId: STUDENT,
        marksObtained: 70,
        markedBy: "u-sub",
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_cancelled" });

    // Restore a mark from before the cancellation, then try to moderate it.
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ status: "ongoing" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
    await saveExamResult(TENANT, {
      id: "er-before-cancel",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 70,
      markedBy: "u-sub",
    });
    await withTenant(TENANT, (tx) =>
      tx
        .update(exams)
        .set({ status: "cancelled" })
        .where(and(eq(exams.workspaceSubdomain, TENANT), eq(exams.id, EXAM))),
    );
    await expect(
      applyExamResultModeration(TENANT, {
        examId: EXAM,
        studentId: STUDENT,
        graceMarks: 2,
        reason: "late moderation",
        actorId: "u-mod",
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "exam_cancelled" });
  });
});

describe("exam lifecycle is audited", () => {
  it("writes CREATE, DELETE and RESTORE events with the actor and reason", async () => {
    const createdExamId = "ex-sub-created";
    await saveExam(TENANT, {
      id: createdExamId,
      name: "Newly created",
      subject: "Quran",
      date: "2026-03-10",
      duration: 60,
      totalMarks: 120,
      passingMarks: 50,
      classIds: [CLASS],
      status: "ongoing",
      description: "",
    });
    await bulkSoftDeleteExams(TENANT, [createdExamId], "u-admin", "scheduling mistake");
    await bulkRestoreExams(TENANT, [createdExamId], "u-admin");

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({
          actionType: auditTrailEvents.actionType,
          newState: auditTrailEvents.newState,
        })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exams"),
            eq(auditTrailEvents.recordId, createdExamId),
          ),
        ),
    );
    const actions = events.map((event) => event.actionType);
    expect(actions).toContain("CREATE");
    expect(actions).toContain("DELETE");
    expect(actions).toContain("RESTORE");
    expect(events.some((event) => event.newState?.includes("scheduling mistake"))).toBe(true);
  });

  it("audits a whole-collection marks replacement as one summary row", async () => {
    await saveExamResult(TENANT, {
      id: "er-replace-1",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 55,
      markedBy: "u-sub",
    });
    await replaceExamResultsForWorkspace(TENANT, [
      { id: "er-replace-1", examId: EXAM, studentId: STUDENT, marksObtained: 65 },
    ]);

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ recordId: auditTrailEvents.recordId, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exam_results"),
            eq(auditTrailEvents.recordId, `workspace:${TENANT}`),
          ),
        ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.newState).toContain("restore_replacement");
  });
});

describe("eligibility overrides are revocable and audited", () => {
  it("audits a grant, a revocation and a re-grant distinctly", async () => {
    await grantEligibilityOverride(TENANT, {
      examId: EXAM,
      studentId: STUDENT,
      reason: "medical leave",
      grantedBy: "u-admin",
    });
    await expect(
      revokeEligibilityOverride(TENANT, {
        examId: EXAM,
        studentId: STUDENT,
        reason: "student recovered and sat the exam",
        revokedBy: "u-admin",
      }),
    ).resolves.toBe(true);
    await grantEligibilityOverride(TENANT, {
      examId: EXAM,
      studentId: STUDENT,
      reason: "re-opened after appeal",
      grantedBy: "u-admin",
    });

    const remaining = await withTenant(TENANT, (tx) =>
      tx
        .select({ revokedAt: examEligibilityOverrides.revokedAt })
        .from(examEligibilityOverrides)
        .where(
          and(
            eq(examEligibilityOverrides.workspaceSubdomain, TENANT),
            eq(examEligibilityOverrides.examId, EXAM),
          ),
        ),
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.revokedAt).toBeNull();

    const events = await withTenant(TENANT, (tx) =>
      tx
        .select({ actionType: auditTrailEvents.actionType, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "exam_eligibility_overrides"),
          ),
        )
        // Chain order is the identity order; without it a heap/partition scan can permute rows.
        .orderBy(auditTrailEvents.id),
    );
    expect(events.map((event) => event.actionType)).toEqual(["CREATE", "UPDATE", "UPDATE"]);
    expect(events.some((event) => event.newState?.includes("eligibility_override_revoked"))).toBe(
      true,
    );
  });
});

describe("report analytics (real Postgres)", () => {
  it("computes subject pass rates, grade distribution, top performers and section averages", async () => {
    await saveExamResult(TENANT, {
      id: "er-analytics",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 80,
      markedBy: "u-sub",
    });

    const aggregates = await loadExaminationsReportAggregatesSql(TENANT);
    const analytics = aggregates.analytics;
    expect(analytics).toBeDefined();
    expect(analytics?.subjectPassRates).toEqual([
      expect.objectContaining({
        subject: expect.any(String),
        total: 1,
        passed: 1,
        passRatePct: 100,
      }),
    ]);
    expect(analytics?.gradeDistribution).toHaveLength(6);
    expect(analytics?.gradeDistribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    expect(analytics?.topPerformers[0]).toMatchObject({ studentId: STUDENT, exams: 1 });
    expect(analytics?.sectionAverages[0]?.total).toBe(1);
  });

  it("excludes draft marks from a published-only analytics read (read-only audience)", async () => {
    await saveExamResult(TENANT, {
      id: "er-analytics-draft",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 80,
      markedBy: "u-sub",
    });

    // A grader sees the draft-derived analytics.
    const all = await loadExaminationsReportAggregatesSql(TENANT);
    expect(all.analytics?.subjectPassRates).toHaveLength(1);

    // A caller who cannot grade only sees published marks: the exam is unpublished, so every
    // aggregate is empty rather than exposing draft pass rates / top performers.
    const publishedOnly = await loadExaminationsReportAggregatesSql(TENANT, undefined, {
      publishedOnly: true,
    });
    expect(publishedOnly.analytics?.subjectPassRates).toEqual([]);
    expect(publishedOnly.analytics?.topPerformers).toEqual([]);
    expect(publishedOnly.analytics?.sectionAverages).toEqual([]);
  });
});

describe("enrollment archive keeps the historical evidence", () => {
  it("drops the student from the roster but keeps their marks, and re-includes them on restore", async () => {
    await saveExamResult(TENANT, {
      id: "er-archived",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 70,
      markedBy: "u-sub",
    });

    try {
      await withTenant(TENANT, (tx) =>
        tx
          .update(enrollments)
          .set({ deletedAt: new Date() })
          .where(
            and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.studentId, STUDENT)),
          ),
      );

      // Archived enrollment: no longer markable, but the result is not destroyed.
      expect(await loadExamRoster(TENANT, EXAM)).toHaveLength(0);
      const page = await listExamResultsPage(TENANT, { examId: EXAM });
      expect(page.results.map((row) => row.studentId)).toContain(STUDENT);
    } finally {
      await withTenant(TENANT, (tx) =>
        tx
          .update(enrollments)
          .set({ deletedAt: null })
          .where(
            and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.studentId, STUDENT)),
          ),
      );
    }

    const restored = await loadExamRoster(TENANT, EXAM);
    expect(restored.map((row) => row.studentId)).toContain(STUDENT);
  });
});

describe("student archive and purge around exam evidence", () => {
  it("keeps marks when a student is archived, drops them from the roster, and restores", async () => {
    await saveExamResult(TENANT, {
      id: "er-student-archive",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 81,
      markedBy: "u-sub",
    });

    const archivedAt = new Date();
    await withTenant(TENANT, async (tx) => {
      await tx
        .update(students)
        .set({ deletedAt: archivedAt, deletedBy: "u-admin" })
        .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, STUDENT)));
      await cascadeSoftDeleteEnrollmentsForStudents(
        tx,
        TENANT,
        [STUDENT],
        "u-admin",
        undefined,
        archivedAt,
      );
    });

    // Archived student: not markable, but the exam result is retained for transcripts/audit.
    expect(await loadExamRoster(TENANT, EXAM)).toHaveLength(0);
    expect((await listExamResultsPage(TENANT, { examId: EXAM })).results).toHaveLength(1);

    await withTenant(TENANT, (tx) =>
      Promise.all([
        tx
          .update(students)
          .set({ deletedAt: null, deletedBy: null })
          .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, STUDENT))),
        tx
          .update(enrollments)
          .set({ deletedAt: null, deletedBy: null })
          .where(
            and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.studentId, STUDENT)),
          ),
      ]),
    );

    expect((await loadExamRoster(TENANT, EXAM)).map((row) => row.studentId)).toContain(STUDENT);
  });

  it("hides an archived exam from analytics but keeps its marks for restore", async () => {
    await saveExamResult(TENANT, {
      id: "er-exam-archive",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 82,
      markedBy: "u-sub",
    });
    const before = await loadExaminationsReportAggregatesSql(TENANT);
    expect(before.analytics?.subjectPassRates[0]?.total).toBe(1);

    await bulkSoftDeleteExams(TENANT, [EXAM], "u-admin", "archived for review");
    const archived = await loadExaminationsReportAggregatesSql(TENANT);
    expect(archived.analytics?.subjectPassRates ?? []).toHaveLength(0);
    expect((await listExamResultsPage(TENANT, { examId: EXAM })).results).toHaveLength(1);

    await bulkRestoreExams(TENANT, [EXAM], "u-admin");
    expect((await loadExaminationsReportAggregatesSql(TENANT)).analytics?.subjectPassRates).toEqual(
      before.analytics?.subjectPassRates,
    );
  });

  it("keeps marks when an enrollment is hard-purged (enrollment is not the mark owner)", async () => {
    await saveExamResult(TENANT, {
      id: "er-enrollment-purge",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 74,
    });
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .delete(enrollments)
        .where(and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.studentId, STUDENT)));
    });
    expect((await listExamResultsPage(TENANT, { examId: EXAM })).results).toHaveLength(1);
  });
  it("pins the student hard-purge FK cascade (retention decision pending)", async () => {
    await saveExamResult(TENANT, {
      id: "er-student-purge",
      examId: EXAM,
      studentId: STUDENT,
      marksObtained: 77,
    });

    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .update(enrollments)
        .set({ deletedAt: new Date() })
        .where(and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.studentId, STUDENT)));
      await tx
        .delete(students)
        .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, STUDENT)));
    });

    // The FK is ON DELETE CASCADE: a real purge destroys exam marks. This test makes the behaviour
    // explicit so a future retention guard (block or archive-copy) must update it deliberately.
    expect((await listExamResultsPage(TENANT, { examId: EXAM })).results).toHaveLength(0);
  });
});
