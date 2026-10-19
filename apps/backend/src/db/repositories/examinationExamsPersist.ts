import { toDbDate } from "../../lib/dbDate.js";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Exam } from "@mms/shared";
import { exams, examClasses } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { resolveCatalogRefsTx } from "./academicCatalogSnapshot.js";

export async function saveExam(tenant: string, record: Exam): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const [subjectRef] = await resolveCatalogRefsTx(tx, "subjects", subdomain, [
      { id: record.subjectId, name: record.subject },
    ]);
    await tx
      .insert(exams)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        subject: subjectRef.name,
        subjectId: subjectRef.id,
        totalMarks: record.totalMarks ?? 100,
        passingMarks: record.passingMarks ?? 50,
        date: toDbDate(record.date),
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
          subject: subjectRef.name,
          subjectId: subjectRef.id,
          totalMarks: record.totalMarks ?? 100,
          passingMarks: record.passingMarks ?? 50,
          date: toDbDate(record.date),
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
    const subjectRefs = await resolveCatalogRefsTx(
      tx,
      "subjects",
      subdomain,
      uniqueRecords.map((r) => ({ id: r.subjectId, name: r.subject })),
    );
    await tx
      .insert(exams)
      .values(
        uniqueRecords.map((r, index) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          subject: subjectRefs[index].name,
          subjectId: subjectRefs[index].id,
          totalMarks: r.totalMarks ?? 100,
          passingMarks: r.passingMarks ?? 50,
          date: toDbDate(r.date),
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
          subjectId: sql`excluded.subject_id`,
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
    const subjectRefs = await resolveCatalogRefsTx(
      tx,
      "subjects",
      subdomain,
      uniqueRecords.map((r) => ({ id: r.subjectId, name: r.subject })),
    );
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, subdomain));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(exams).values(
        uniqueRecords.map((r, index) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
          subject: subjectRefs[index].name,
          subjectId: subjectRefs[index].id,
          totalMarks: r.totalMarks ?? 100,
          passingMarks: r.passingMarks ?? 50,
          date: toDbDate(r.date),
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
