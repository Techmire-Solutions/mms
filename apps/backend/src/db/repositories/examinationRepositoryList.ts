import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  asc,
  desc,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type Exam,
  type ExaminationsCommandMetricsSnapshot,
  type ExaminationsListQuery,
  type ExaminationsListPageResult,
} from "@mms/shared";
import { examResults, exams, examClasses } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { examRowToRecord } from "./examinationRepository.js";

function buildExamsListConditions(subdomain: string, query: ExaminationsListQuery): SQL[] {
  const conditions: SQL[] = [eq(exams.workspaceSubdomain, subdomain)];

  // Manifest softDelete.workExcludesDeleted — Work = active, trash = deleted-only.
  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(exams.deletedAt));
  } else {
    conditions.push(isNull(exams.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    const pattern = toSqlSearchPattern(search);
    conditions.push(or(ilike(exams.name, pattern), ilike(exams.subject, pattern)) as SQL);
  }

  const statuses = dedupeTrimmedIds(query.status);
  if (statuses.length) {
    conditions.push(inArray(exams.status, statuses));
  }

  return conditions;
}

const EXAM_SORT_FIELDS = new Set(["name", "subject", "status", "date", "updatedAt"]);

function buildExamsOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim();
  let column: AnyColumn;
  if (field && EXAM_SORT_FIELDS.has(field)) {
    switch (field) {
      case "updatedAt":
        column = exams.updatedAt;
        break;
      case "name":
        column = exams.name;
        break;
      case "subject":
        column = exams.subject;
        break;
      case "status":
        column = exams.status;
        break;
      case "date":
        column = exams.date;
        break;
      default:
        column = exams.updatedAt;
    }
  } else {
    column = exams.updatedAt;
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}

type ExamRow = typeof exams.$inferSelect;

export async function listExamsPage(
  tenant: string,
  query: ExaminationsListQuery & { afterId?: string; skipCount?: boolean },
): Promise<ExaminationsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage<ExamRow, ExamRow>(tx, exams, {
      conditions: buildExamsListConditions(subdomain, query),
      orderBy: buildExamsOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: (row) => row,
    });

    const examRows = result.items;
    let examRecords: Exam[] = [];

    if (examRows.length > 0) {
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

      examRecords = examRows.map((row) => examRowToRecord(row, classMap.get(row.id) ?? []));
    }

    return {
      exams: examRecords,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

/** SQL aggregates for Examinations command-centre metrics (active exams only). */
export async function aggregateExaminationsCommandMetrics(
  tenant: string,
): Promise<ExaminationsCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [examRow] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        upcoming: sql<number>`count(*) FILTER (WHERE ${exams.status} = 'upcoming')::int`,
        ongoing: sql<number>`count(*) FILTER (WHERE ${exams.status} = 'ongoing')::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${exams.status} = 'completed')::int`,
        scheduled: sql<number>`count(*) FILTER (WHERE ${exams.status} = 'scheduled')::int`,
        cancelled: sql<number>`count(*) FILTER (WHERE ${exams.status} = 'cancelled')::int`,
      })
      .from(exams)
      .where(and(eq(exams.workspaceSubdomain, subdomain), isNull(exams.deletedAt)));

    // LEFT JOIN to active exams so orphan/deleted-exam results still count toward
    // totalResults/examsWithResults but not toward the pass-rate denominator (scored).
    const [resultRow] = await tx
      .select({
        totalResults: sql<number>`count(*)::int`,
        examsWithResults: sql<number>`count(DISTINCT ${examResults.examId})::int`,
        scored: sql<number>`count(${exams.id})::int`,
        passed: sql<number>`count(*) FILTER (WHERE ${exams.id} IS NOT NULL AND ${examResults.marksObtained} >= ${exams.passingMarks})::int`,
      })
      .from(examResults)
      .leftJoin(
        exams,
        and(
          eq(examResults.workspaceSubdomain, exams.workspaceSubdomain),
          eq(examResults.examId, exams.id),
          isNull(exams.deletedAt),
        ),
      )
      .where(eq(examResults.workspaceSubdomain, subdomain));

    const scored = Number(resultRow?.scored ?? 0);
    const passed = Number(resultRow?.passed ?? 0);
    return {
      total: Number(examRow?.total ?? 0),
      upcoming: Number(examRow?.upcoming ?? 0),
      ongoing: Number(examRow?.ongoing ?? 0),
      completed: Number(examRow?.completed ?? 0),
      scheduled: Number(examRow?.scheduled ?? 0),
      cancelled: Number(examRow?.cancelled ?? 0),
      totalResults: Number(resultRow?.totalResults ?? 0),
      examsWithResults: Number(resultRow?.examsWithResults ?? 0),
      passRate: scored > 0 ? Math.round((passed / scored) * 100) : 0,
    };
  });
}
