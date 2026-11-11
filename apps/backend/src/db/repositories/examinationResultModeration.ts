import { and, eq, sql } from "drizzle-orm";
import { MAX_MARKS_OBTAINED, resolveResultScore } from "@mms/shared";
import { examResults, exams } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { assertMarksWritable } from "./examinationMarksLock.js";

/**
 * Audited grace-mark moderation, split from `examinationResultsPersist.ts` for the 300-line band.
 *
 * Moderation is a *scoring* write, so it obeys the same lock as marks entry: a published exam is
 * immutable and an archived one is not writable. `marks_obtained` is preserved verbatim — the
 * adjustment lives beside it, which is what keeps a moderated result explainable later.
 */

/** The moderation payload the use case decided; the raw mark is never part of it. */
export interface ExamResultModerationInput {
  examId: string;
  studentId: string;
  graceMarks: number;
  reason: string;
  actorId: string;
  /** OCC token the moderator read; a stale token refuses the write. */
  version?: number;
}

export interface ExamResultModerationResult {
  examId: string;
  studentId: string;
  marksObtained: number;
  graceMarks: number;
  effectiveMarks: number;
  moderationReason: string | null;
  moderatedAt: string | null;
  version: number;
}

/**
 * Applies (or clears) an audited grace-mark adjustment on one mark.
 *
 * Moderation is a *scoring* write, so it obeys the same lock as marks entry: a published exam is
 * immutable (`409 exam_results_finalized`) and an archived one is not writable. `marks_obtained`
 * is preserved verbatim — the adjustment lives beside it, which is what keeps a moderated result
 * explainable later. The effective score bound is enforced here and again by the DB trigger.
 */
export async function applyExamResultModeration(
  tenant: string,
  input: ExamResultModerationInput,
): Promise<ExamResultModerationResult> {
  const subdomain = tenant.trim().toLowerCase();
  const reason = input.reason.trim();
  if (reason.length < 3) throw new ValidationError("A moderation reason is required");
  if (!Number.isFinite(input.graceMarks) || input.graceMarks < 0) {
    throw new ValidationError("Grace marks must be a non-negative number");
  }
  if (input.graceMarks > MAX_MARKS_OBTAINED) {
    throw new ValidationError(`Grace marks cannot exceed ${MAX_MARKS_OBTAINED}`);
  }

  return withTenant(subdomain, async (tx) => {
    await assertMarksWritable(tx, subdomain, [input.examId]);

    const [exam] = await tx
      .select({ totalMarks: exams.totalMarks })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)))
      .limit(1);
    if (!exam) throw new NotFoundError("Exam not found");

    const [before] = await tx
      .select({
        id: examResults.id,
        marksObtained: examResults.marksObtained,
        graceMarks: examResults.graceMarks,
        moderationReason: examResults.moderationReason,
        version: examResults.version,
      })
      .from(examResults)
      .where(
        and(
          eq(examResults.workspaceSubdomain, subdomain),
          eq(examResults.examId, input.examId),
          eq(examResults.studentId, input.studentId),
        ),
      )
      .limit(1)
      .for("update");
    if (!before) throw new NotFoundError("Mark not found for this student and exam");

    if (typeof input.version === "number" && before.version !== input.version) {
      throw new ConflictError(
        `Marks for student ${input.studentId} in exam ${input.examId} were changed by someone else — reload and retry`,
        "stale_write",
      );
    }

    const effectiveMarks = Number(before.marksObtained) + input.graceMarks;
    if (effectiveMarks > Number(exam.totalMarks)) {
      throw new ValidationError(
        `Marks plus grace (${effectiveMarks}) cannot exceed the exam total (${exam.totalMarks})`,
      );
    }

    const moderatedAt = new Date();
    const [row] = await tx
      .update(examResults)
      .set({
        graceMarks: input.graceMarks,
        moderationReason: input.graceMarks > 0 ? reason : null,
        moderatedBy: input.actorId,
        moderatedAt,
        version: sql`${examResults.version} + 1`,
        updatedAt: moderatedAt,
      })
      .where(
        and(
          eq(examResults.workspaceSubdomain, subdomain),
          eq(examResults.examId, input.examId),
          eq(examResults.studentId, input.studentId),
        ),
      )
      .returning({
        marksObtained: examResults.marksObtained,
        graceMarks: examResults.graceMarks,
        version: examResults.version,
      });
    if (!row) throw new NotFoundError("Mark not found for this student and exam");

    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exam_results",
      recordId: before.id,
      actionType: "UPDATE",
      realUserId: input.actorId,
      oldState: {
        graceMarks: before.graceMarks,
        moderationReason: before.moderationReason ?? null,
      },
      newState: {
        graceMarks: row.graceMarks,
        moderationReason: input.graceMarks > 0 ? reason : null,
        reason,
        reasonCode: "moderation",
      },
      minimizeDelta: true,
    });

    const score = resolveResultScore({
      marksObtained: row.marksObtained,
      totalMarks: Number(exam.totalMarks),
      passingMarks: 0,
      graceMarks: row.graceMarks,
    });

    return {
      examId: input.examId,
      studentId: input.studentId,
      marksObtained: Number(row.marksObtained),
      graceMarks: Number(row.graceMarks),
      effectiveMarks: score.effectiveMarks,
      moderationReason: input.graceMarks > 0 ? reason : null,
      moderatedAt: moderatedAt.toISOString(),
      version: row.version,
    };
  });
}
