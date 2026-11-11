import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type ExamResult } from "@mms/shared";
import { examResults, exams } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Read surface for exam marks. Writes, OCC, moderation and the publication lock live in
 * `examinationResultsPersist.ts`; re-exported here so `examinationRepository.ts` stays the single
 * import surface for the module.
 */
export { applyExamResultModeration } from "./examinationResultModeration.js";
export {
  bulkSaveExamResults,
  deleteExaminationsByWorkspace,
  replaceExamResultsForWorkspace,
  saveExamResult,
} from "./examinationResultsPersist.js";

type ResultRow = Pick<
  typeof examResults.$inferSelect,
  | "id"
  | "examId"
  | "studentId"
  | "marksObtained"
  | "version"
  | "markedBy"
  | "graceMarks"
  | "moderationReason"
  | "moderatedBy"
  | "moderatedAt"
  | "createdAt"
  | "updatedAt"
>;

function resultRowToRecord(row: ResultRow): ExamResult {
  return {
    id: row.id,
    examId: row.examId,
    studentId: row.studentId,
    marksObtained: row.marksObtained,
    // The client must be able to round-trip the token it read, or OCC degrades to last-write-wins.
    version: row.version,
    markedBy: row.markedBy ?? null,
    graceMarks: row.graceMarks,
    moderationReason: row.moderationReason ?? null,
    moderatedBy: row.moderatedBy ?? null,
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
    // Timestamps are part of the backup payload: the restore re-inserts them verbatim.
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const RESULT_COLUMNS = {
  id: examResults.id,
  examId: examResults.examId,
  studentId: examResults.studentId,
  marksObtained: examResults.marksObtained,
  version: examResults.version,
  markedBy: examResults.markedBy,
  graceMarks: examResults.graceMarks,
  moderationReason: examResults.moderationReason,
  moderatedBy: examResults.moderatedBy,
  moderatedAt: examResults.moderatedAt,
  createdAt: examResults.createdAt,
  updatedAt: examResults.updatedAt,
};

const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 500;

export interface ExamResultsPageQuery {
  examId?: string;
  studentId?: string;
  cursor?: string;
  limit?: number;
  /**
   * Only marks from published (finalised) exams. Read-only audiences — anyone who cannot grade —
   * never see draft marks, so the staff endpoint cannot leak unpublished results if it is ever
   * reused for a narrower surface.
   */
  publishedOnly?: boolean;
}

export interface ExamResultsPage {
  results: ExamResult[];
  hasMore: boolean;
}

/**
 * Keyset-paginated marks for one workspace, optionally filtered by exam/student.
 *
 * The previous `listExamResultsByWorkspace` capped at 500 rows and the API returned it as if it
 * were the complete set, so a broadsheet past 500 marks silently produced wrong ranks and averages.
 * Callers page until `hasMore` is false.
 */
export async function listExamResultsPage(
  tenant: string,
  query: ExamResultsPageQuery = {},
): Promise<ExamResultsPage> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const conditions = [eq(examResults.workspaceSubdomain, subdomain)];
  if (query.examId) conditions.push(eq(examResults.examId, query.examId.trim()));
  if (query.studentId) conditions.push(eq(examResults.studentId, query.studentId.trim()));
  if (query.cursor) conditions.push(gt(examResults.id, query.cursor.trim()));

  return withTenantRead(subdomain, async (tx) => {
    const base = tx.select(RESULT_COLUMNS).from(examResults);
    const statement = query.publishedOnly
      ? base.innerJoin(
          exams,
          and(
            eq(exams.workspaceSubdomain, examResults.workspaceSubdomain),
            eq(exams.id, examResults.examId),
            isNotNull(exams.resultsFinalizedAt),
            isNull(exams.deletedAt),
          ),
        )
      : base;
    const rows = await statement
      .where(and(...conditions))
      .orderBy(examResults.id)
      // One extra row tells the caller whether another page exists, without a COUNT.
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { results: page.map(resultRowToRecord), hasMore };
  });
}

/** Stable identity of an exam's marks state — used to key broadsheet exports. */
export interface ExamResultsFingerprint {
  count: number;
  maxUpdatedAt: string | null;
}

/**
 * Cheap fingerprint of one exam's marks (`count`, newest `updated_at`).
 *
 * The broadsheet export key includes it so a re-export after a correction produces a fresh
 * artifact, while a double-click on an unchanged exam still dedupes to the same job.
 */
export async function findExamResultsFingerprint(
  tenant: string,
  examId: string,
): Promise<ExamResultsFingerprint> {
  const subdomain = tenant.trim().toLowerCase();
  const trimmedExamId = examId?.trim();
  if (!trimmedExamId) return { count: 0, maxUpdatedAt: null };
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        maxUpdatedAt: sql<string | null>`max(${examResults.updatedAt})::text`,
      })
      .from(examResults)
      .where(
        and(eq(examResults.workspaceSubdomain, subdomain), eq(examResults.examId, trimmedExamId)),
      );
    return { count: Number(row?.count ?? 0), maxUpdatedAt: row?.maxUpdatedAt ?? null };
  });
}

/** Whole-workspace marks for the backup/restore snapshot (not a request-path read). */
export async function listExamResultsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<ExamResult[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(RESULT_COLUMNS)
      .from(examResults)
      .where(eq(examResults.workspaceSubdomain, subdomain))
      .orderBy(examResults.id)
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
      .select(RESULT_COLUMNS)
      .from(examResults)
      .where(and(eq(examResults.workspaceSubdomain, subdomain), eq(examResults.id, trimmedId)));
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
      .select(RESULT_COLUMNS)
      .from(examResults)
      .where(and(eq(examResults.workspaceSubdomain, subdomain), inArray(examResults.id, cleanIds)));
    return rows.map(resultRowToRecord);
  });
}

/** The OCC identity of every existing mark in one exam. */
export interface ExamResultVersionRef {
  studentId: string;
  id: string;
  version: number;
}

/**
 * Existing mark versions for one exam, so a non-interactive writer can participate in OCC.
 *
 * The queued CSV marks import used to build rows without a token; that takes the last-write-wins
 * upsert branch and silently overwrites a concurrent examiner's correction. Reading the current
 * version per student lets the importer send the token the grid would have sent, turning a
 * concurrent edit into a per-row `stale_write` instead of data loss.
 *
 * Scoped by the `(workspace, exam)` prefix of the natural-key unique index (0222/0236).
 */
export async function findExamResultVersionsByExam(
  tenant: string,
  examId: string,
): Promise<ExamResultVersionRef[]> {
  const subdomain = tenant.trim().toLowerCase();
  const trimmedExamId = examId?.trim();
  if (!trimmedExamId) return [];
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        studentId: examResults.studentId,
        id: examResults.id,
        version: examResults.version,
      })
      .from(examResults)
      .where(
        and(eq(examResults.workspaceSubdomain, subdomain), eq(examResults.examId, trimmedExamId)),
      );
    return rows.map((row) => ({
      studentId: row.studentId,
      id: row.id,
      version: row.version,
    }));
  });
}
