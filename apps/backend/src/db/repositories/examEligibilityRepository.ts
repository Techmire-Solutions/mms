import { and, eq, inArray, isNull } from "drizzle-orm";
import { examEligibilityOverrides, exams } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { ValidationError } from "../../lib/httpErrors.js";

export type {
  ExamEligibilityRow,
  ExamEligibilityView,
  ExamRosterEntry,
  ExamStudentSection,
} from "./examEligibilityBatchRepository.js";
export {
  loadExamEligibility,
  loadExamEligibilityBatch,
  loadExamRoster,
  loadExamStudentSections,
} from "./examEligibilityBatchRepository.js";

/**
 * Exam eligibility writes: the exam-level gate, the audited overrides (grant / revoke) and the
 * active-override lookup the marks gate uses.
 *
 * The batched read path lives in `examEligibilityBatchRepository.ts`; the types are re-exported
 * above so callers keep one import surface.
 */

/** Sets (or clears) the exam's own attendance gate. */
export async function setExamAttendanceGate(
  tenant: string,
  input: { examId: string; minAttendancePct: number | null; actorId: string },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const [before] = await tx
      .select({ minAttendancePct: exams.minAttendancePct })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)))
      .limit(1);
    if (!before) return;
    await tx
      .update(exams)
      .set({ minAttendancePct: input.minAttendancePct, updatedAt: new Date() })
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, input.examId)));
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exams",
      recordId: input.examId,
      actionType: "UPDATE",
      realUserId: input.actorId,
      oldState: { minAttendancePct: before.minAttendancePct },
      newState: { minAttendancePct: input.minAttendancePct },
      minimizeDelta: true,
    });
  });
}

/** Grants an audited override so one student may sit the exam despite the threshold. */
export async function grantEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; grantedBy: string },
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const [existing] = await tx
      .select({
        reason: examEligibilityOverrides.reason,
        grantedBy: examEligibilityOverrides.grantedBy,
        grantedAt: examEligibilityOverrides.grantedAt,
        revokedAt: examEligibilityOverrides.revokedAt,
      })
      .from(examEligibilityOverrides)
      .where(
        and(
          eq(examEligibilityOverrides.workspaceSubdomain, subdomain),
          eq(examEligibilityOverrides.examId, input.examId),
          eq(examEligibilityOverrides.studentId, input.studentId),
        ),
      )
      .limit(1);

    await tx
      .insert(examEligibilityOverrides)
      .values({
        workspaceSubdomain: subdomain,
        examId: input.examId,
        studentId: input.studentId,
        reason: input.reason,
        grantedBy: input.grantedBy,
        grantedAt: new Date(),
        revokedAt: null,
        revokedBy: null,
      })
      .onConflictDoUpdate({
        target: [
          examEligibilityOverrides.workspaceSubdomain,
          examEligibilityOverrides.examId,
          examEligibilityOverrides.studentId,
        ],
        set: {
          reason: input.reason,
          grantedBy: input.grantedBy,
          grantedAt: new Date(),
          revokedAt: null,
          revokedBy: null,
        },
      });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exam_eligibility_overrides",
      recordId: `${input.examId}:${input.studentId}`,
      // A repeat grant overwrites an existing decision; it is an UPDATE, not a fresh CREATE.
      actionType: existing ? "UPDATE" : "CREATE",
      realUserId: input.grantedBy,
      ...(existing
        ? {
            oldState: {
              reason: existing.reason,
              grantedBy: existing.grantedBy,
              grantedAt: existing.grantedAt?.toISOString() ?? null,
              revokedAt: existing.revokedAt?.toISOString() ?? null,
            },
          }
        : {}),
      newState: { examId: input.examId, studentId: input.studentId, reason: input.reason },
      minimizeDelta: true,
    });
  });
}

/**
 * Revokes an active eligibility override.
 *
 * The column pair existed from 0222 but nothing ever wrote `revoked_at`, so an override was
 * permanent. Revocation keeps the evidence (the row stays, with who/when) and records the reason on
 * the audit event; granting again later re-activates the same row (audited as an UPDATE).
 */
export async function revokeEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; revokedBy: string },
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const reason = input.reason.trim();
  if (reason.length < 3) throw new ValidationError("A revocation reason is required");
  return withTenant(subdomain, async (tx) => {
    const [existing] = await tx
      .select({
        reason: examEligibilityOverrides.reason,
        grantedBy: examEligibilityOverrides.grantedBy,
        grantedAt: examEligibilityOverrides.grantedAt,
      })
      .from(examEligibilityOverrides)
      .where(
        and(
          eq(examEligibilityOverrides.workspaceSubdomain, subdomain),
          eq(examEligibilityOverrides.examId, input.examId),
          eq(examEligibilityOverrides.studentId, input.studentId),
          isNull(examEligibilityOverrides.revokedAt),
        ),
      )
      .limit(1);
    if (!existing) return false;

    const revokedAt = new Date();
    await tx
      .update(examEligibilityOverrides)
      .set({ revokedAt, revokedBy: input.revokedBy })
      .where(
        and(
          eq(examEligibilityOverrides.workspaceSubdomain, subdomain),
          eq(examEligibilityOverrides.examId, input.examId),
          eq(examEligibilityOverrides.studentId, input.studentId),
          isNull(examEligibilityOverrides.revokedAt),
        ),
      );

    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exam_eligibility_overrides",
      recordId: `${input.examId}:${input.studentId}`,
      actionType: "UPDATE",
      realUserId: input.revokedBy,
      oldState: {
        reason: existing.reason,
        grantedBy: existing.grantedBy,
        grantedAt: existing.grantedAt?.toISOString() ?? null,
        revokedAt: null,
      },
      newState: {
        examId: input.examId,
        studentId: input.studentId,
        revokedAt: revokedAt.toISOString(),
        revokedBy: input.revokedBy,
        reason,
        reasonCode: "eligibility_override_revoked",
      },
      minimizeDelta: true,
    });
    return true;
  });
}

/** Active overrides for a batch of students, used by the results-entry gate. */
export async function listActiveOverrides(
  tenant: string,
  examIds: readonly string[],
  studentIds: readonly string[],
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (examIds.length === 0 || studentIds.length === 0) return new Set();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        examId: examEligibilityOverrides.examId,
        studentId: examEligibilityOverrides.studentId,
      })
      .from(examEligibilityOverrides)
      .where(
        and(
          eq(examEligibilityOverrides.workspaceSubdomain, subdomain),
          inArray(examEligibilityOverrides.examId, [...examIds]),
          inArray(examEligibilityOverrides.studentId, [...studentIds]),
          isNull(examEligibilityOverrides.revokedAt),
        ),
      );
    return new Set(rows.map((row) => `${row.examId}|${row.studentId}`));
  });
}
