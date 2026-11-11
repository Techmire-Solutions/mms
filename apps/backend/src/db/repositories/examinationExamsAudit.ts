import type { AppDb } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import type { ExamWriteState } from "../../examinations/domain/examWriteGuards.js";

/** The incoming exam fields the scoring-frame comparison needs. */
export interface ExamScoringFrameIntent {
  status?: string | null;
  subjectId?: string | null;
  name: string;
  totalMarks: number;
  passingMarks: number;
  date: string | null;
  duration: number;
  classIds: readonly string[];
  description?: string;
}

/**
 * Fields whose change re-grades and re-ranks every student on the exam.
 *
 * These edits used to be silent: `total_marks`/`passing_marks`/`date`/`subject`/status were written
 * by the bulk upsert with no audit row, so a result could change meaning with no attributable
 * record. Only real changes are emitted (no-op saves stay quiet).
 */
export function scoringFrameChanges(
  current: ExamWriteState,
  incoming: ExamScoringFrameIntent,
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const push = (field: string, from: unknown, to: unknown) => {
    if (from !== to) changes[field] = { from, to };
  };
  push("name", current.name, incoming.name);
  push("subjectId", current.subjectId ?? null, incoming.subjectId ?? null);
  push("totalMarks", current.totalMarks, incoming.totalMarks);
  push("passingMarks", current.passingMarks, incoming.passingMarks);
  push("date", current.date ?? null, incoming.date ?? null);
  push("duration", current.duration, incoming.duration);
  push("status", current.status, incoming.status ?? current.status);
  // Instructions/notes can steer grading, so they are part of the audited frame.
  push(
    "description",
    (current as ExamWriteState & { description?: string }).description ?? "",
    incoming.description ?? "",
  );

  const before = [...current.classIds].sort().join(",");
  const after = [...incoming.classIds].sort().join(",");
  if (before !== after) changes.classIds = { from: before, to: after };

  return Object.keys(changes).length > 0 ? changes : null;
}

/** Appends one audit event per exam whose scoring frame changed. */
export async function auditScoringFrameChange(
  tx: AppDb,
  subdomain: string,
  examId: string,
  changes: Record<string, { from: unknown; to: unknown }>,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: "exams",
    recordId: examId,
    actionType: "UPDATE",
    oldState: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
    newState: {
      ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
      // A pure status move is an override; anything else rewrites the scoring frame.
      reasonCode:
        Object.keys(changes).length === 1 && "status" in changes
          ? "status_override"
          : "scoring_frame",
    },
    minimizeDelta: true,
  });
}

/** One CREATE event with the exam's full scoring frame. */
export async function auditExamCreated(
  tx: AppDb,
  subdomain: string,
  examId: string,
  frame: ExamScoringFrameIntent,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: "exams",
    recordId: examId,
    actionType: "CREATE",
    newState: {
      name: frame.name,
      subjectId: frame.subjectId ?? null,
      totalMarks: frame.totalMarks,
      passingMarks: frame.passingMarks,
      date: frame.date,
      duration: frame.duration,
      status: frame.status ?? "upcoming",
      classIds: [...frame.classIds].sort(),
      reasonCode: "exam_created",
    },
  });
}

/** DELETE / RESTORE event for the soft-delete lifecycle, with the operator's reason. */
export async function auditExamArchiveChange(
  tx: AppDb,
  subdomain: string,
  examId: string,
  action: "DELETE" | "RESTORE",
  actorId: string | null,
  reason: string | null,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: "exams",
    recordId: examId,
    actionType: action,
    realUserId: actorId,
    oldState: action === "DELETE" ? { deletedAt: null } : { deletedAt: "archived" },
    newState: {
      deletedAt: action === "DELETE" ? new Date().toISOString() : null,
      reason: reason ?? null,
      reasonCode: action === "DELETE" ? "exam_archived" : "exam_restored",
    },
  });
}

/** One summary event for a whole-collection replacement (backup/restore path). */
export async function auditCollectionReplacement(
  tx: AppDb,
  subdomain: string,
  tableName: "exams" | "exam_results",
  beforeCount: number,
  afterCount: number,
  actorId: string | null,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName,
    recordId: `workspace:${subdomain}`,
    actionType: "UPDATE",
    realUserId: actorId,
    oldState: { rows: beforeCount },
    newState: { rows: afterCount, reasonCode: "restore_replacement" },
  });
}
