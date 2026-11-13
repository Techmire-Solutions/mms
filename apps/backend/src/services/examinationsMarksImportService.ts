import { createHash } from "node:crypto";
import { MAX_MARKS_OBTAINED, type ExamResult } from "@mms/shared";
import { NotFoundError } from "../lib/httpErrors.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { examinationsRepository } from "../examinations/repository/examinationsRepositoryAdapter.js";
import { examEligibilityRepository } from "../examinations/repository/examEligibilityAdapter.js";
import { examinationsUseCases } from "../examinations/use-cases/examinationsUseCases.js";
import { assertExamResultsEligible } from "../examinations/use-cases/examEligibilityGate.js";
import { recordAuditEventSafely } from "./auditTrailService.js";

/**
 * Bulk marks import (`examinations:marks-import`).
 *
 * Rows are `{ rollNumber, marksObtained }`; the roll is resolved against the exam's own roster
 * (the seat-holding enrollments), so a wrong roll fails that row instead of landing on another
 * student. Marks are bounded by the exam total and `MAX_MARKS_OBTAINED`, and the write goes through
 * the normal marks upsert — published exams still refuse (409) and every changed mark is audited.
 *
 * Idempotent by natural key `(exam, student)`: a replayed job re-upserts the same rows.
 */

const CHUNK_SIZE = 100;

export interface MarksImportJobPayload {
  examId: string;
  label?: string;
  rows: Array<{ rollNumber: string; marksObtained: number | string }>;
}

function deterministicResultId(examId: string, studentId: string): string {
  const hash = createHash("sha1").update(`${examId}|${studentId}`).digest("hex");
  return `er-${hash.slice(0, 24)}`;
}

function planRow(
  examId: string,
  row: { rollNumber: string; marksObtained: number | string },
  rosterByRoll: Map<string, string[]>,
  examTotalMarks: number,
  existingByStudent: Map<string, { id: string; version: number }>,
): { result: ExamResult } | { error: string } {
  const roll = String(row.rollNumber ?? "").trim();
  const matches = rosterByRoll.get(roll) ?? [];
  if (matches.length === 0) return { error: `Roll number "${roll}" is not enrolled in this exam` };
  if (matches.length > 1) {
    return { error: `Roll number "${roll}" matches ${matches.length} students; fix the roster` };
  }
  // An empty cell is "not entered", never a zero mark — the route schema rejects it too, but the
  // runner is where a replayed/legacy payload lands.
  if (typeof row.marksObtained === "string" && row.marksObtained.trim() === "") {
    return { error: "Marks must be a number" };
  }
  const marks = Number(row.marksObtained);
  if (!Number.isFinite(marks)) return { error: "Marks must be a number" };
  if (marks < 0) return { error: "Marks cannot be negative" };
  if (marks > examTotalMarks) {
    return { error: `Marks ${marks} exceed the exam total (${examTotalMarks})` };
  }
  if (marks > MAX_MARKS_OBTAINED) {
    return { error: `Marks cannot exceed ${MAX_MARKS_OBTAINED}` };
  }
  const studentId = matches[0]!;
  // The grid echoes the stored id + version; the importer must too, or it takes the
  // last-write-wins upsert branch and silently overwrites a concurrent correction.
  const existing = existingByStudent.get(studentId);
  return {
    result: {
      id: existing?.id ?? deterministicResultId(examId, studentId),
      examId: "",
      studentId,
      marksObtained: marks,
      ...(existing ? { version: existing.version } : {}),
    } as unknown as ExamResult,
  };
}

export function registerExaminationsMarksImportJobRunner(): void {
  registerBackgroundJobRunner("examinations:marks-import", async (payload, ctx) => {
    const data = payload as MarksImportJobPayload;
    const examId = String(data.examId ?? "").trim();
    if (!examId) throw new NotFoundError("Exam not found");

    const exam = await examinationsRepository.findExamById(ctx.tenant, examId);
    if (!exam) throw new NotFoundError("Exam not found");

    const roster = await examEligibilityRepository.loadExamRoster(ctx.tenant, examId);
    const rosterByRoll = new Map<string, string[]>();
    for (const entry of roster) {
      const roll = entry.rollNumber.trim();
      if (!roll) continue;
      const list = rosterByRoll.get(roll) ?? [];
      list.push(entry.studentId);
      rosterByRoll.set(roll, list);
    }

    const rows = Array.isArray(data.rows) ? data.rows : [];
    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;

    // The importer is a non-interactive writer: echo the stored OCC identity of every mark it is
    // about to replace, so a concurrent correction surfaces as a per-row `stale_write` error
    // instead of being silently overwritten. Rows with no stored mark stay token-less inserts.
    const existingByStudent = new Map<string, { id: string; version: number }>();
    for (const ref of await examinationsRepository.findExamResultVersionsByExam(
      ctx.tenant,
      examId,
    )) {
      existingByStudent.set(ref.studentId, { id: ref.id, version: ref.version });
    }

    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      throwIfBackgroundJobAborted(ctx.signal);
      const slice = rows.slice(start, start + CHUNK_SIZE);
      const batch: ExamResult[] = [];
      for (const [offset, row] of slice.entries()) {
        const planned = planRow(examId, row, rosterByRoll, exam.totalMarks, existingByStudent);
        if ("error" in planned) {
          errors.push({ row: start + offset + 1, reason: planned.error });
        } else {
          // Attribute the write like a grid save: the importer is the actor, and the audit delta
          // takes its realUserId from `markedBy`.
          batch.push({ ...planned.result, examId, markedBy: ctx.userId });
        }
      }
      if (batch.length > 0) {
        try {
          // The queued importer used to write marks without the attendance/roster/override gate
          // that the grid save runs; a below-threshold student could be graded by CSV.
          await assertExamResultsEligible(ctx.tenant, batch);
          await examinationsUseCases.upsertExamResults(batch);
          imported += batch.length;
        } catch {
          // Attribute the failure row-by-row so one unpublished/over-bounds/blocked row does not
          // fail the whole chunk; a stale row reports its OCC conflict instead of overwriting the
          // mark, and the blocked row is rejected by the same gate.
          for (const [offset, result] of batch.entries()) {
            throwIfBackgroundJobAborted(ctx.signal);
            try {
              await assertExamResultsEligible(ctx.tenant, [result]);
              await examinationsUseCases.upsertExamResults([result]);
              imported += 1;
            } catch (error) {
              errors.push({
                row: start + offset + 1,
                reason: error instanceof Error ? error.message : "Failed to import this mark",
              });
            }
          }
        }
      }
      await ctx.updateProgress(Math.min(start + slice.length, rows.length), rows.length);
    }

    throwIfBackgroundJobAborted(ctx.signal);
    // Per-mark writes are audited by the persist layer; this is the job-level evidence of who
    // imported which file into which exam, and how much of it applied.
    await recordAuditEventSafely({
      workspaceSubdomain: ctx.tenant,
      tableName: "exam_results",
      recordId: examId,
      actionType: "UPDATE",
      realUserId: ctx.userId,
      newState: {
        reasonCode: "marks_import",
        examId,
        imported,
        rejected: errors.length,
        jobId: ctx.jobId,
      },
    });

    await ctx.complete({
      label: data.label ?? `Imported ${imported} of ${rows.length} marks`,
      progress: { current: imported, total: Math.max(rows.length, 1) },
      hasDownload: false,
      ...(errors.length > 0 ? { errors: errors.slice(0, 500) } : {}),
    });
  });
}
