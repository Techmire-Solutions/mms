import { and, count, eq, inArray, isNull } from "drizzle-orm";
import {
  contacts,
  enrollments,
  examClasses,
  examResults,
  sessionClasses,
  sessions,
  students,
} from "../schema.js";
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

/** Persisted lifecycle state needed to decide whether a publication change is legal. */
export interface ExamLifecycleState {
  id: string;
  status: string;
  resultsFinalizedAt: Date | null;
  deletedAt: Date | null;
}

/**
 * Reads the exam row under `FOR UPDATE`.
 *
 * The lock is the point: publishing and mark entry are the two writers that must not interleave, so
 * the publish path holds the exam row while it validates, and the marks path takes `FOR SHARE` on
 * the same row (see `assertMarksWritable` in `examinationResultsPersist.ts`).
 */
export async function findExamLifecycleState(
  tenant: string,
  examId: string,
): Promise<ExamLifecycleState | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .select({
        id: exams.id,
        status: exams.status,
        resultsFinalizedAt: exams.resultsFinalizedAt,
        deletedAt: exams.deletedAt,
      })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, examId)))
      .limit(1)
      .for("update");
    return row ?? null;
  });
}

/** How many marks exist for the exam — publishing an exam nobody sat is a mistake, not a state. */
export async function countExamResultsForExam(tenant: string, examId: string): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ total: count() })
      .from(examResults)
      .where(and(eq(examResults.workspaceSubdomain, subdomain), eq(examResults.examId, examId)));
    return Number(rows[0]?.total ?? 0);
  });
}

/** Statuses of the sessions that own this exam's classes. */
export async function findOwningSessionStatuses(tenant: string, examId: string): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ status: sessions.status })
      .from(examClasses)
      .innerJoin(
        sessionClasses,
        and(
          eq(sessionClasses.workspaceSubdomain, examClasses.workspaceSubdomain),
          eq(sessionClasses.id, examClasses.classId),
        ),
      )
      .innerJoin(
        sessions,
        and(
          eq(sessions.workspaceSubdomain, sessionClasses.workspaceSubdomain),
          eq(sessions.id, sessionClasses.sessionId),
        ),
      )
      .where(and(eq(examClasses.workspaceSubdomain, subdomain), eq(examClasses.examId, examId)));
    return [...new Set(rows.map((row) => String(row.status)))];
  });
}

/**
 * Writes the publication stamp and the status the lifecycle use-case decided.
 *
 * The *decision* (what the next status is) lives in `examLifecycleUseCases.ts`; this function only
 * persists it, so the persistence layer never invents domain state.
 */
export async function setExamResultsFinalized(
  tenant: string,
  input: {
    examId: string;
    resultsFinalizedAt: Date | null;
    status: string;
    actorId: string;
    reason?: string | null;
  },
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

    const [row] = await tx
      .update(exams)
      .set({
        resultsFinalizedAt: input.resultsFinalizedAt,
        status: input.status,
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
      newState: {
        resultsFinalizedAt: input.resultsFinalizedAt
          ? input.resultsFinalizedAt.toISOString()
          : null,
        status: row?.status,
        reasonCode: input.resultsFinalizedAt ? "publication" : "unpublish",
        ...(input.reason ? { reason: input.reason } : {}),
      },
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
