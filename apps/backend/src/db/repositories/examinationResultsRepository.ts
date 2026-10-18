import { and, eq, inArray, sql } from 'drizzle-orm';
import { dedupeTrimmedIds, type ExamResult } from '@mms/shared';
import { examResults, examClasses, exams } from '../schema.js';
import { withTenant, withTenantRead } from '../tenant-context.js';

type ResultRow = Pick<typeof examResults.$inferSelect, 'id' | 'examId' | 'studentId' | 'marksObtained'>;

function resultRowToRecord(row: ResultRow): ExamResult {
  return {
    id: row.id,
    examId: row.examId,
    studentId: row.studentId,
    marksObtained: row.marksObtained,
  };
}

export async function listExamResultsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<ExamResult[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: examResults.id,
        examId: examResults.examId,
        studentId: examResults.studentId,
        marksObtained: examResults.marksObtained,
      })
      .from(examResults)
      .where(eq(examResults.workspaceSubdomain, subdomain))
      .limit(limit)
      .offset(offset);
    return rows.map(resultRowToRecord);
  });
}

export async function findExamResultById(tenant: string, id: string): Promise<ExamResult | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: examResults.id,
        examId: examResults.examId,
        studentId: examResults.studentId,
        marksObtained: examResults.marksObtained,
      })
      .from(examResults)
      .where(
        and(
          eq(examResults.workspaceSubdomain, subdomain),
          eq(examResults.id, trimmedId),
        ),
      );
    const row = rows[0];
    return row ? resultRowToRecord(row) : null;
  });
}

export async function findExamResultsByIds(tenant: string, ids: string[]): Promise<ExamResult[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: examResults.id,
        examId: examResults.examId,
        studentId: examResults.studentId,
        marksObtained: examResults.marksObtained,
      })
      .from(examResults)
      .where(
        and(
          eq(examResults.workspaceSubdomain, subdomain),
          inArray(examResults.id, cleanIds),
        ),
      );
    return rows.map(resultRowToRecord);
  });
}

export async function saveExamResult(tenant: string, record: ExamResult): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(examResults)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        examId: record.examId,
        studentId: record.studentId,
        marksObtained: record.marksObtained ?? 0,
        markedBy: record.markedBy ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [examResults.workspaceSubdomain, examResults.id],
        set: {
          examId: record.examId,
          studentId: record.studentId,
          marksObtained: record.marksObtained ?? 0,
          markedBy: record.markedBy ?? null,
          updatedAt: new Date(),
        },
      });
  });
}

export async function bulkSaveExamResults(tenant: string, records: ExamResult[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ExamResult>();
  for (const r of records) {
    const cleanId = typeof r.id === 'string' ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(examResults)
      .values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          examId: r.examId,
          studentId: r.studentId,
          marksObtained: r.marksObtained ?? 0,
          markedBy: r.markedBy ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [examResults.workspaceSubdomain, examResults.id],
        set: {
          examId: sql`excluded.exam_id`,
          studentId: sql`excluded.student_id`,
          marksObtained: sql`excluded.marks_obtained`,
          markedBy: sql`excluded.marked_by`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function replaceExamResultsForWorkspace(tenant: string, records: ExamResult[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ExamResult>();
  for (const r of records) {
    const cleanId = typeof r.id === 'string' ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(examResults).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          examId: r.examId,
          studentId: r.studentId,
          marksObtained: r.marksObtained ?? 0,
          markedBy: r.markedBy ?? null,
          updatedAt: new Date(),
        })),
      );
    }
  });
}

export async function deleteExaminationsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, subdomain));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, subdomain));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, subdomain));
  });
}
