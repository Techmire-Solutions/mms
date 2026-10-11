import { and, eq, inArray } from "drizzle-orm";
import { type Student } from "@mms/shared";
import { studentEnrolledSessions } from "../schema.js";
import type { AppDb } from "../tenant-context.js";

/**
 * Bulk diff-based sync of enrolled sessions across a batch of students.
 * Fetches all existing sessions in one query via `inArray`, diffs in-memory,
 * and performs targeted bulk delete and insert only for students whose sessions changed.
 */
export async function syncBulkStudentEnrolledSessionsTx(
  tx: AppDb,
  subdomain: string,
  items: Student[],
): Promise<void> {
  const candidates = items.filter(
    (s) => s.enrolledSessions !== undefined && String(s.id).trim().length > 0,
  );
  if (candidates.length === 0) return;

  const candidateIds = candidates.map((s) => String(s.id));

  // 1. Single batch query to fetch all existing sessions for candidate students
  const existingRows = await tx
    .select({
      studentId: studentEnrolledSessions.studentId,
      sessionId: studentEnrolledSessions.sessionId,
    })
    .from(studentEnrolledSessions)
    .where(
      and(
        eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
        inArray(studentEnrolledSessions.studentId, candidateIds),
      ),
    );

  const existingMap = new Map<string, Set<string>>();
  for (const row of existingRows) {
    let set = existingMap.get(row.studentId);
    if (!set) {
      set = new Set();
      existingMap.set(row.studentId, set);
    }
    set.add(row.sessionId);
  }

  const studentIdsToDelete: string[] = [];
  const rowsToInsert: Array<{
    id: string;
    workspaceSubdomain: string;
    studentId: string;
    sessionId: string;
    sortOrder: number;
  }> = [];

  for (const student of candidates) {
    const studentId = String(student.id);
    const newSessions = Array.isArray(student.enrolledSessions)
      ? student.enrolledSessions.map(String).filter((s) => s.trim().length > 0)
      : [];
    const existingSet = existingMap.get(studentId) ?? new Set<string>();

    const areSame =
      existingSet.size === newSessions.length && newSessions.every((s) => existingSet.has(s));

    if (!areSame) {
      studentIdsToDelete.push(studentId);
      newSessions.forEach((sessionId, idx) => {
        rowsToInsert.push({
          id: `${studentId}_sess_${idx}_${sessionId.slice(0, 30)}`,
          workspaceSubdomain: subdomain,
          studentId,
          sessionId,
          sortOrder: idx,
        });
      });
    }
  }

  // 2. Batch delete only for students whose sessions actually changed
  if (studentIdsToDelete.length > 0) {
    await tx
      .delete(studentEnrolledSessions)
      .where(
        and(
          eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
          inArray(studentEnrolledSessions.studentId, studentIdsToDelete),
        ),
      );
  }

  // 3. Batch insert new session rows
  if (rowsToInsert.length > 0) {
    await tx.insert(studentEnrolledSessions).values(rowsToInsert);
  }
}
