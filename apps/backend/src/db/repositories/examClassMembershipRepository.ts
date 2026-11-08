import { and, eq, inArray, isNull } from "drizzle-orm";
import { contacts, enrollments, examClasses, students } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { exams } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Exam-class membership lookups, results finalisation and student labels.
 * Split from the eligibility repository for the 300-line band.
 */

/** Exam ids of the student's classes that are not cancelled (for enrollment validation). */
export async function findExamClassIds(tenant: string, examId: string): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ classId: examClasses.classId })
      .from(examClasses)
      .where(and(eq(examClasses.workspaceSubdomain, subdomain), eq(examClasses.examId, examId)));
    return rows.map((row) => String(row.classId));
  });
}

/** Student ids enrolled (live) in any of the given classes. */
export async function listEnrolledStudentIds(
  tenant: string,
  classIds: readonly string[],
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (classIds.length === 0) return new Set();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          inArray(enrollments.classId, [...classIds]),
          isNull(enrollments.deletedAt),
        ),
      );
    return new Set(rows.map((row) => String(row.studentId)));
  });
}

/**
 * Finalises (or re-opens) an exam's results.
 *
 * 0207 added `results_finalized_at` and completion only counts finalised exams, but nothing ever
 * wrote the column — so `requiresExamPass` could never be satisfied. This is that missing writer.
 */
export async function setExamResultsFinalized(
  tenant: string,
  input: { examId: string; finalized: boolean; actorId: string },
): Promise<{ examId: string; resultsFinalizedAt: Date | null; status: string } | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [before] = await tx
      .select({
        resultsFinalizedAt: exams.resultsFinalizedAt,
        status: exams.status,
      })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)))
      .limit(1);
    if (!before) return null;

    const at = input.finalized ? new Date() : null;
    const [row] = await tx
      .update(exams)
      .set({
        resultsFinalizedAt: at,
        status: input.finalized ? "completed" : before.status,
        updatedAt: new Date(),
      })
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)))
      .returning({
        id: exams.id,
        resultsFinalizedAt: exams.resultsFinalizedAt,
        status: exams.status,
      });

    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exams",
      recordId: input.examId,
      actionType: "UPDATE",
      realUserId: input.actorId,
      oldState: {
        resultsFinalizedAt: before.resultsFinalizedAt
          ? before.resultsFinalizedAt.toISOString()
          : null,
        status: before.status,
      },
      newState: { resultsFinalizedAt: at ? at.toISOString() : null, status: row?.status },
      minimizeDelta: true,
    });

    return {
      examId: input.examId,
      resultsFinalizedAt: row?.resultsFinalizedAt ?? null,
      status: String(row?.status ?? before.status),
    };
  });
}

/** Student display names for the alert/eligibility payloads. */
export async function findStudentNames(
  tenant: string,
  studentIds: readonly string[],
): Promise<Map<string, string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (studentIds.length === 0) return new Map();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: students.id, name: contacts.name, grNumber: students.grNumber })
      .from(students)
      .leftJoin(
        contacts,
        and(
          eq(contacts.workspaceSubdomain, students.workspaceSubdomain),
          eq(contacts.id, students.contactId),
        ),
      )
      .where(
        and(eq(students.workspaceSubdomain, subdomain), inArray(students.id, [...studentIds])),
      );
    return new Map(rows.map((row) => [String(row.id), String(row.name || row.grNumber || row.id)]));
  });
}
