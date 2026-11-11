import type { User } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";
import {
  assertTeacherAnyClassScope,
  assertTeacherExamScope,
  type ClassSectionDate,
} from "../../sessions/use-cases/teacherSectionScope.js";
import { examinationsRepository } from "../repository/examinationsRepositoryAdapter.js";
import { examEligibilityRepository as eligibilityRepo } from "../repository/examEligibilityAdapter.js";

/** A submitted CSV row — only the roll number is needed to resolve the target section. */
export interface MarksImportScopeRow {
  rollNumber: string;
}

/**
 * Teacher row-scope for the queued marks import.
 *
 * The grid save runs `assertTeacherExamScope` inside `authorizeAndStampExamResults`, but the CSV
 * importer wrote straight through the use case with only the attendance/roster gate — a
 * faculty-linked teacher could import marks for **any** section of any exam, and a non-faculty user
 * with `examinations.write` (refused by the grid) was accepted. This runs the exact same rule at
 * enqueue time, resolving each submitted roll against the exam's own roster.
 *
 * Unknown or ambiguous rolls are skipped here: the worker already rejects them per row, and they
 * must not widen the actor's scope. Only the exam's roster students can be written.
 */
export async function assertMarksImportScope(
  user: User,
  tenant: string,
  examId: string,
  rows: readonly MarksImportScopeRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const exam = await examinationsRepository.findExamById(tenant, examId);
  // A missing exam is reported by the route/worker as 404; there is nothing to scope.
  if (!exam) return;

  const roster = await eligibilityRepo.loadExamRoster(tenant, examId);
  const byRoll = new Map<string, typeof roster>();
  for (const entry of roster) {
    const roll = String(entry.rollNumber ?? "").trim();
    if (!roll) continue;
    const bucket = byRoll.get(roll) ?? [];
    bucket.push(entry);
    byRoll.set(roll, bucket);
  }

  const entries: ClassSectionDate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const matches = byRoll.get(String(row.rollNumber ?? "").trim()) ?? [];
    if (matches.length !== 1) continue;
    const entry = matches[0]!;
    const key = `${entry.classId}|${entry.sectionId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      classId: entry.classId,
      sectionId: entry.sectionId ?? null,
      onDate: exam.date ?? "",
    });
  }
  if (entries.length === 0) return;

  try {
    if (exam.date) {
      await assertTeacherExamScope(user, tenant, entries);
      return;
    }
    // An undated exam keeps the class-level rule, exactly like the grid save.
    await assertTeacherAnyClassScope(user, tenant, [
      entries.map((entry) => ({ classId: entry.classId, date: "" })),
    ]);
  } catch (error) {
    const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
    if (statusCode === 403) {
      throw new HttpDomainError(
        403,
        "exam_marks_import_forbidden",
        error instanceof Error ? error.message : "You cannot import marks for this exam",
        { details: { examId } },
      );
    }
    throw error;
  }
}
