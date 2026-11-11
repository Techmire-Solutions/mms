import { toDbDate } from "../../lib/dbDate.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Exam } from "@mms/shared";
import { exams, examClasses } from "../schema.js";
import { withTenant, type AppDb } from "../tenant-context.js";
import { resolveCatalogRefsTx } from "./academicCatalogSnapshot.js";
import {
  auditExamCreated,
  auditScoringFrameChange,
  scoringFrameChanges,
} from "./examinationExamsAudit.js";
import {
  assertExamTransitionAllowed,
  assertPublishedExamImmutable,
  type ExamWriteState,
} from "../../examinations/domain/examWriteGuards.js";

/**
 * Current persisted state for the exams a write is about, including their class membership.
 * The lifecycle and publication guards need it inside the same transaction as the write, so it is
 * read here rather than in the route layer.
 */
async function loadExamWriteStates(
  tx: AppDb,
  subdomain: string,
  ids: readonly string[],
): Promise<Map<string, ExamWriteState>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({
      id: exams.id,
      status: exams.status,
      resultsFinalizedAt: exams.resultsFinalizedAt,
      name: exams.name,
      subjectId: exams.subjectId,
      totalMarks: exams.totalMarks,
      passingMarks: exams.passingMarks,
      date: exams.date,
      duration: exams.duration,
    })
    .from(exams)
    .where(and(eq(exams.workspaceSubdomain, subdomain), inArray(exams.id, [...ids])));

  const classRows = await tx
    .select({ examId: examClasses.examId, classId: examClasses.classId })
    .from(examClasses)
    .where(
      and(eq(examClasses.workspaceSubdomain, subdomain), inArray(examClasses.examId, [...ids])),
    );

  const classMap = new Map<string, string[]>();
  for (const row of classRows) {
    const list = classMap.get(row.examId) ?? [];
    list.push(row.classId);
    classMap.set(row.examId, list);
  }

  return new Map(
    rows.map((row) => [row.id, { ...row, classIds: classMap.get(row.id) ?? [] }] as const),
  );
}

/** Normalizes the incoming record to the guarded surface (empty subject id means "none"). */
function toWriteIntent(record: Exam) {
  return {
    status: record.status ?? null,
    subjectId: record.subjectId?.trim() ? String(record.subjectId) : null,
    name: record.name,
    totalMarks: record.totalMarks ?? 100,
    passingMarks: record.passingMarks ?? 50,
    date: toDbDate(record.date),
    duration: record.duration ?? 60,
    classIds: (record.classIds ?? []).filter(Boolean).map(String),
    description: record.description ?? "",
  };
}

export async function saveExam(tenant: string, record: Exam): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const states = await loadExamWriteStates(tx, subdomain, [record.id]);
    const current = states.get(record.id) ?? null;
    assertExamTransitionAllowed(current, record.status);
    if (current) assertPublishedExamImmutable(record.id, current, toWriteIntent(record));

    const [resolvedSubject] = await resolveCatalogRefsTx(tx, "subjects", subdomain, [
      { id: record.subjectId, name: record.subject },
    ]);
    const frameChanges = current
      ? scoringFrameChanges(current, { ...toWriteIntent(record), subjectId: resolvedSubject.id })
      : null;

    const status = record.status ?? current?.status ?? "upcoming";
    const totalMarks = record.totalMarks ?? 100;
    const passingMarks = record.passingMarks ?? 50;
    const duration = record.duration ?? 60;
    const description = record.description ?? "";
    const date = toDbDate(record.date);

    const subjectId = resolvedSubject.id;

    await tx
      .insert(exams)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        subjectId,
        totalMarks,
        passingMarks,
        date,
        duration,
        status,
        description,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exams.workspaceSubdomain, exams.id],
        set: {
          name: record.name,
          subjectId,
          totalMarks,
          passingMarks,
          date,
          duration,
          status,
          description,
          updatedAt: new Date(),
          // Deletion fields are deliberately NOT written here: soft delete/resurrect is owned by
          // the audited DELETE/restore routes, so a bulk upsert can no longer archive or revive an
          // exam behind their back (see docs/examinations-schema-persistence-audit-2026-11-11.md).
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

    if (frameChanges) {
      await auditScoringFrameChange(tx, subdomain, record.id, frameChanges);
    }
    if (!current) {
      // Creating an exam was the one lifecycle action with no audit row at all.
      await auditExamCreated(tx, subdomain, record.id, {
        ...toWriteIntent(record),
        subjectId,
      });
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
    const states = await loadExamWriteStates(
      tx,
      subdomain,
      uniqueRecords.map((r) => r.id),
    );
    for (const record of uniqueRecords) {
      const current = states.get(record.id) ?? null;
      assertExamTransitionAllowed(current, record.status);
      if (current) assertPublishedExamImmutable(record.id, current, toWriteIntent(record));
    }

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
          subjectId: subjectRefs[index].id,
          totalMarks: r.totalMarks ?? 100,
          passingMarks: r.passingMarks ?? 50,
          date: toDbDate(r.date),
          duration: r.duration ?? 60,
          status: r.status ?? states.get(r.id)?.status ?? "upcoming",
          description: r.description ?? "",
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [exams.workspaceSubdomain, exams.id],
        set: {
          name: sql`excluded.name`,
          subjectId: sql`excluded.subject_id`,
          totalMarks: sql`excluded.total_marks`,
          passingMarks: sql`excluded.passing_marks`,
          date: sql`excluded.date`,
          duration: sql`excluded.duration`,
          status: sql`excluded.status`,
          description: sql`excluded.description`,
          updatedAt: new Date(),
          // See `saveExam`: deletion fields belong to the dedicated soft-delete routes.
        },
      });

    const frameChangesByExam = new Map<string, Record<string, { from: unknown; to: unknown }>>();
    uniqueRecords.forEach((record, index) => {
      const current = states.get(record.id);
      if (!current) return;
      const changes = scoringFrameChanges(current, {
        ...toWriteIntent(record),
        subjectId: subjectRefs[index]?.id ?? null,
      });
      if (changes) frameChangesByExam.set(record.id, changes);
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
