import { and, eq } from "drizzle-orm";
import { studentEnrolledSessions } from "../schema.js";
import type { AppDb } from "../tenant-context.js";

/**
 * Diff-based sync of enrolled sessions for a single student.
 * If sessions haven't changed, does nothing (avoids delete/insert churn).
 */
export async function syncStudentEnrolledSessionsTx(
  tx: AppDb,
  subdomain: string,
  studentId: string,
  enrolledSessions?: Array<string | number>,
): Promise<void> {
  const newSessions = Array.isArray(enrolledSessions)
    ? enrolledSessions.map(String).filter((s) => s.trim().length > 0)
    : [];

  const existing = await tx
    .select({ sessionId: studentEnrolledSessions.sessionId })
    .from(studentEnrolledSessions)
    .where(
      and(
        eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
        eq(studentEnrolledSessions.studentId, studentId),
      ),
    );

  const existingSet = new Set(existing.map((e) => e.sessionId));
  const areSame =
    existingSet.size === newSessions.length && newSessions.every((s) => existingSet.has(s));
  if (areSame) return;

  await tx
    .delete(studentEnrolledSessions)
    .where(
      and(
        eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
        eq(studentEnrolledSessions.studentId, studentId),
      ),
    );

  if (newSessions.length > 0) {
    await tx.insert(studentEnrolledSessions).values(
      newSessions.map((sessionId, idx) => ({
        id: `${studentId}_sess_${idx}_${sessionId.slice(0, 30)}`,
        workspaceSubdomain: subdomain,
        studentId,
        sessionId,
        sortOrder: idx,
      })),
    );
  }
}
