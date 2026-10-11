import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Exam, type RepositoryListOptions } from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { exams, examClasses } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type ExamRow = typeof exams.$inferSelect;

export function examRowToRecord(row: ExamRow, classIds: string[] = []): Exam {
  const exam: Exam = {
    id: row.id,
    name: row.name,
    subject: row.subject,
    totalMarks: row.totalMarks,
    passingMarks: row.passingMarks,
    date: row.date,
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

export async function saveExam(tenant: string, record: Exam): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(exams)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        subject: record.subject ?? "",
        totalMarks: record.totalMarks ?? 100,
        passingMarks: record.passingMarks ?? 50,
        date: record.date,
        duration: record.duration ?? 60,
        status: record.status ?? "upcoming",
        description: record.description ?? "",
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exams.workspaceSubdomain, exams.id],
        set: {
          name: record.name,
          subject: record.subject ?? "",
          totalMarks: record.totalMarks ?? 100,
          passingMarks: record.passingMarks ?? 50,
          date: record.date,
          duration: record.duration ?? 60,
          status: record.status ?? "upcoming",
          description: record.description ?? "",
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });

    await tx
      .delete(examClasses)
      .where(and(eq(examClasses.workspaceSubdomain, subdomain), eq(examClasses.examId, record.id)));

    const validClassIds = (record.classIds ?? []).filter(Boolean);
    if (validClassIds.length > 0) {
      await tx.insert(examClasses).values(
        validClassIds.map((classId) => ({
          workspaceSubdomain: subdomain,
          examId: record.id,
          classId,
        })),
      );
    }
  });
}

export async function bulkSaveExams(tenant: string, records: Exam[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Exam>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(exams)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          subject: r.subject ?? "",
          totalMarks: r.totalMarks ?? 100,
          passingMarks: r.passingMarks ?? 50,
          date: r.date,
          duration: r.duration ?? 60,
          status: r.status ?? "upcoming",
          description: r.description ?? "",
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [exams.workspaceSubdomain, exams.id],
        set: {
          name: sql`excluded.name`,
          subject: sql`excluded.subject`,
          totalMarks: sql`excluded.total_marks`,
          passingMarks: sql`excluded.passing_marks`,
          date: sql`excluded.date`,
          duration: sql`excluded.duration`,
          status: sql`excluded.status`,
          description: sql`excluded.description`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });

    const examIds = uniqueRecords.map((r) => r.id);
    await tx
      .delete(examClasses)
      .where(
        and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.examId, examIds)),
      );

    const classPairs: Array<{
      workspaceSubdomain: string;
      examId: string;
      classId: string;
    }> = [];
    const pairSet = new Set<string>();
    for (const r of uniqueRecords) {
      for (const rawClassId of r.classIds ?? []) {
        const classId = typeof rawClassId === "string" ? rawClassId.trim() : String(rawClassId);
        if (classId) {
          const key = `${r.id}:${classId}`;
          if (!pairSet.has(key)) {
            pairSet.add(key);
            classPairs.push({
              workspaceSubdomain: subdomain,
              examId: r.id,
              classId,
            });
          }
        }
      }
    }
    if (classPairs.length > 0) {
      await tx.insert(examClasses).values(classPairs);
    }
  });
}

export async function replaceExamsForWorkspace(tenant: string, records: Exam[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Exam>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, subdomain));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(exams).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          subject: r.subject ?? "",
          totalMarks: r.totalMarks ?? 100,
          passingMarks: r.passingMarks ?? 50,
          date: r.date,
          duration: r.duration ?? 60,
          status: r.status ?? "upcoming",
          description: r.description ?? "",
          deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          deletedBy: r.deletedBy ?? null,
          deletionReason: r.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      );

      const classPairs: Array<{
        workspaceSubdomain: string;
        examId: string;
        classId: string;
      }> = [];
      const pairSet = new Set<string>();
      for (const r of uniqueRecords) {
        for (const rawClassId of r.classIds ?? []) {
          const classId = typeof rawClassId === "string" ? rawClassId.trim() : String(rawClassId);
          if (classId) {
            const key = `${r.id}:${classId}`;
            if (!pairSet.has(key)) {
              pairSet.add(key);
              classPairs.push({
                workspaceSubdomain: subdomain,
                examId: r.id,
                classId,
              });
            }
          }
        }
      }
      if (classPairs.length > 0) {
        await tx.insert(examClasses).values(classPairs);
      }
    }
  });
}

export async function bulkSoftDeleteExams(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(exams)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(exams.workspaceSubdomain, subdomain),
          inArray(exams.id, uniqueIds),
          isNull(exams.deletedAt),
        ),
      )
      .returning({ id: exams.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreExams(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(exams)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(exams.workspaceSubdomain, subdomain),
          inArray(exams.id, uniqueIds),
          isNotNull(exams.deletedAt),
        ),
      )
      .returning({ id: exams.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
