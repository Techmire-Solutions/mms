import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds, type Exam, type RepositoryListOptions } from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { exams, examClasses } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
export {
  saveExam,
  bulkSaveExams,
  replaceExamsForWorkspace,
  bulkSoftDeleteExams,
  bulkRestoreExams,
} from "./examinationExamsPersist.js";

type ExamRow = typeof exams.$inferSelect;

export function examRowToRecord(row: ExamRow, classIds: string[] = []): Exam {
  const exam: Exam = {
    id: row.id,
    name: row.name,
    subject: row.subject,
    subjectId: row.subjectId ?? "",
    totalMarks: row.totalMarks,
    passingMarks: row.passingMarks,
    date: row.date ?? "",
    duration: row.duration,
    classIds,
    status: row.status as Exam["status"],
    description: row.description,
    ...mapAuditTimestamps(row),
  };

  return exam;
}

export type ListExamsOptions = RepositoryListOptions;

export async function listExamsByWorkspace(
  tenant: string,
  options?: ListExamsOptions,
): Promise<Exam[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(exams, subdomain, deletedFilter);
    const examRows = await tx
      .select({
        id: exams.id,
        workspaceSubdomain: exams.workspaceSubdomain,
        name: exams.name,
        subject: exams.subject,
        subjectId: exams.subjectId,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        date: exams.date,
        duration: exams.duration,
        status: exams.status,
        description: exams.description,
        deletedAt: exams.deletedAt,
        deletedBy: exams.deletedBy,
        deletionReason: exams.deletionReason,
        restoredAt: exams.restoredAt,
        restoredBy: exams.restoredBy,
        deletedWithCascade: exams.deletedWithCascade,
        createdAt: exams.createdAt,
        updatedAt: exams.updatedAt,
      })
      .from(exams)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    if (examRows.length === 0) return [];

    const examIds = examRows.map((e) => e.id);
    const classRows = await tx
      .select({
        examId: examClasses.examId,
        classId: examClasses.classId,
      })
      .from(examClasses)
      .where(
        and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.examId, examIds)),
      );

    const classMap = new Map<string, string[]>();
    for (const c of classRows) {
      const list = classMap.get(c.examId) ?? [];
      list.push(c.classId);
      classMap.set(c.examId, list);
    }

    return examRows.map((row) => examRowToRecord(row, classMap.get(row.id) ?? []));
  });
}

export async function findExamById(tenant: string, id: string): Promise<Exam | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: exams.id,
        workspaceSubdomain: exams.workspaceSubdomain,
        name: exams.name,
        subject: exams.subject,
        subjectId: exams.subjectId,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        date: exams.date,
        duration: exams.duration,
        status: exams.status,
        description: exams.description,
        deletedAt: exams.deletedAt,
        deletedBy: exams.deletedBy,
        deletionReason: exams.deletionReason,
        restoredAt: exams.restoredAt,
        restoredBy: exams.restoredBy,
        deletedWithCascade: exams.deletedWithCascade,
        createdAt: exams.createdAt,
        updatedAt: exams.updatedAt,
      })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), eq(exams.id, trimmedId)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const classRows = await tx
      .select({
        examId: examClasses.examId,
        classId: examClasses.classId,
      })
      .from(examClasses)
      .where(and(eq(examClasses.workspaceSubdomain, subdomain), eq(examClasses.examId, trimmedId)));

    return examRowToRecord(
      row,
      classRows.map((c) => c.classId),
    );
  });
}

export async function findExamsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Exam[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(exams.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(exams.deletedAt)
          : isNull(exams.deletedAt);

    const conditions = [eq(exams.workspaceSubdomain, subdomain), inArray(exams.id, cleanIds)];
    if (deletedCond) conditions.push(deletedCond);

    const examRows = await tx
      .select({
        id: exams.id,
        workspaceSubdomain: exams.workspaceSubdomain,
        name: exams.name,
        subject: exams.subject,
        subjectId: exams.subjectId,
        totalMarks: exams.totalMarks,
        passingMarks: exams.passingMarks,
        date: exams.date,
        duration: exams.duration,
        status: exams.status,
        description: exams.description,
        deletedAt: exams.deletedAt,
        deletedBy: exams.deletedBy,
        deletionReason: exams.deletionReason,
        restoredAt: exams.restoredAt,
        restoredBy: exams.restoredBy,
        deletedWithCascade: exams.deletedWithCascade,
        createdAt: exams.createdAt,
        updatedAt: exams.updatedAt,
      })
      .from(exams)
      .where(and(...conditions));

    if (examRows.length === 0) return [];

    const examIds = examRows.map((e) => e.id);
    const classRows = await tx
      .select({
        examId: examClasses.examId,
        classId: examClasses.classId,
      })
      .from(examClasses)
      .where(
        and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.examId, examIds)),
      );

    const classMap = new Map<string, string[]>();
    for (const c of classRows) {
      const list = classMap.get(c.examId) ?? [];
      list.push(c.classId);
      classMap.set(c.examId, list);
    }

    return examRows.map((row) => examRowToRecord(row, classMap.get(row.id) ?? []));
  });
}
