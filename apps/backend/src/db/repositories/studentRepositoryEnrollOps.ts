import { and, eq, inArray, notInArray } from "drizzle-orm";
import { students, studentEnrolledSessions } from "../schema.js";
import { withTenant, type AppDb } from "../tenant-context.js";

/**
 * Bulk enrollment operations for students into sessions.
 * Optimized with the UNIQUE constraint (workspace_subdomain, student_id, session_id):
 * - 'add': inserts with onConflictDoNothing (no unnecessary deletion)
 * - 'remove': deletes only target session rows
 * - 'replace': deletes removed sessions and inserts new sessions
 */
export async function bulkEnrollStudentsTx(
  tx: AppDb,
  subdomain: string,
  studentIds: string[],
  sessionIds: string[],
  mode: "add" | "replace" | "remove" = "add",
): Promise<{ succeeded: number; failed: number }> {
  if (studentIds.length === 0 || sessionIds.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  if (mode === "remove") {
    await tx
      .delete(studentEnrolledSessions)
      .where(
        and(
          eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
          inArray(studentEnrolledSessions.studentId, studentIds),
          inArray(studentEnrolledSessions.sessionId, sessionIds),
        ),
      );
  } else if (mode === "replace") {
    // Delete enrollments that are no longer present
    await tx
      .delete(studentEnrolledSessions)
      .where(
        and(
          eq(studentEnrolledSessions.workspaceSubdomain, subdomain),
          inArray(studentEnrolledSessions.studentId, studentIds),
          notInArray(studentEnrolledSessions.sessionId, sessionIds),
        ),
      );

    const rowsToInsert = studentIds.flatMap((studentId) =>
      sessionIds.map((sessionId, idx) => ({
        id: `${studentId}_sess_${idx}_${String(sessionId).slice(0, 30)}`,
        workspaceSubdomain: subdomain,
        studentId,
        sessionId: String(sessionId),
        sortOrder: idx,
      })),
    );

    if (rowsToInsert.length > 0) {
      await tx
        .insert(studentEnrolledSessions)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [
            studentEnrolledSessions.workspaceSubdomain,
            studentEnrolledSessions.studentId,
            studentEnrolledSessions.sessionId,
          ],
        });
    }
  } else {
    // mode === 'add'
    const rowsToInsert = studentIds.flatMap((studentId) =>
      sessionIds.map((sessionId, idx) => ({
        id: `${studentId}_sess_${idx}_${String(sessionId).slice(0, 30)}`,
        workspaceSubdomain: subdomain,
        studentId,
        sessionId: String(sessionId),
        sortOrder: idx,
      })),
    );

    if (rowsToInsert.length > 0) {
      await tx
        .insert(studentEnrolledSessions)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [
            studentEnrolledSessions.workspaceSubdomain,
            studentEnrolledSessions.studentId,
            studentEnrolledSessions.sessionId,
          ],
        });
    }
  }

  await tx
    .update(students)
    .set({ updatedAt: new Date() })
    .where(and(eq(students.workspaceSubdomain, subdomain), inArray(students.id, studentIds)));

  return { succeeded: studentIds.length, failed: 0 };
}

export async function bulkEnrollStudents(
  tenant: string,
  studentIds: string[],
  sessionIds: string[],
  mode: "add" | "replace" | "remove" = "add",
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    return bulkEnrollStudentsTx(tx, subdomain, studentIds, sessionIds, mode);
  });
}

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
