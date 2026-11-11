import { toDbDate } from "../../lib/dbDate.js";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Exam } from "@mms/shared";
import { exams, examClasses } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { resolveCatalogRefsTx } from "./academicCatalogSnapshot.js";
import { assertExamDeletable } from "../../examinations/domain/examWriteGuards.js";
import { auditCollectionReplacement, auditExamArchiveChange } from "./examinationExamsAudit.js";

/**
 * Exam replacement, trash and restore.
 *
 * Split from `examinationExamsPersist.ts` for the 300-line band (mms-structure-naming §3). The
 * guards these functions need are different from the upsert path's: a *restore* must be able to
 * reintroduce trashed rows verbatim, and a *delete* must refuse a published exam.
 *
 * `replaceExamsForWorkspace` is the backup/restore path only (dbSync runs it under
 * `app.allow_hard_purge`); it deliberately bypasses the lifecycle guards.
 */

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
    const [existing] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(exams)
      .where(eq(exams.workspaceSubdomain, subdomain));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, subdomain));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(exams).values(
        uniqueRecords.map((r, index) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          name: r.name,
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
    await auditCollectionReplacement(
      tx,
      subdomain,
      "exams",
      Number(existing?.total ?? 0),
      uniqueRecords.length,
      null,
    );
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
    // Published results are completion evidence: trashing the exam under them would strand it.
    const live = await tx
      .select({ id: exams.id, resultsFinalizedAt: exams.resultsFinalizedAt })
      .from(exams)
      .where(
        and(
          eq(exams.workspaceSubdomain, subdomain),
          inArray(exams.id, uniqueIds),
          isNull(exams.deletedAt),
        ),
      );
    for (const row of live) assertExamDeletable(row.id, row);

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

    // Trash/restore were the only exam lifecycle mutations with no audit row; a deletion that
    // removed marks from every report must be attributable.
    for (const row of updated) {
      await auditExamArchiveChange(
        tx,
        subdomain,
        row.id,
        "DELETE",
        deletedBy || null,
        deletionReason || null,
      );
    }

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreExams(
  tenant: string,
  ids: string[],
  userId?: string,
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

    for (const row of updated) {
      await auditExamArchiveChange(tx, subdomain, row.id, "RESTORE", userId ?? null, null);
    }

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
