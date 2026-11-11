import { sql } from "drizzle-orm";
import { GRADE_BANDS, LOWEST_GRADE_BAND, type ExaminationsReportAnalytics } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Examinations analytics: subject pass/fail, grade distribution, top performers, section averages.
 *
 * One tenant-scoped read over `exam_results` ⋈ `exams` (both indexed by workspace; exams by date /
 * status / active). Grade buckets are generated from the shared `GRADE_BANDS`, so the histogram can
 * never disagree with the letter printed on a report card. Percentage uses the effective score
 * (marks + grace), and a failed result is always `F` — the same rule as `resolveResultScore`.
 */

/** Percent expression shared by every aggregate. `total > 0` is filtered in the CTE. */
const PCT = sql`((er.marks_obtained + COALESCE(er.grace_marks, 0)) * 100.0 / e.total_marks)`;

function gradeCaseSql(): ReturnType<typeof sql> {
  const nonFail = GRADE_BANDS.filter((band) => band.label !== LOWEST_GRADE_BAND.label);
  const whens = nonFail.map((band) => sql`WHEN ${PCT} >= ${band.minPct} THEN ${band.label}`);
  return sql`CASE WHEN (er.marks_obtained + COALESCE(er.grace_marks, 0)) >= e.passing_marks
    THEN (CASE ${sql.join(whens, sql` `)} ELSE ${LOWEST_GRADE_BAND.label} END)
    ELSE ${LOWEST_GRADE_BAND.label} END`;
}

/**
 * Published-only filter for a read-only audience.
 *
 * `GET /report-aggregates` used to aggregate every mark, including drafts, for any caller with
 * `examinations.read` — the same role the marks list restricts to published exams. The route now
 * passes this flag for non-graders so analytics obey the same boundary.
 */
function publishedOnlyFilter(value: boolean | undefined): ReturnType<typeof sql> {
  return value ? sql`AND e.results_finalized_at IS NOT NULL` : sql``;
}

function scoredCte(subdomain: string, publishedOnly?: boolean): ReturnType<typeof sql> {
  return sql`WITH scored AS (
    SELECT er.student_id AS student_id,
           er.exam_id AS exam_id,
           (er.marks_obtained + COALESCE(er.grace_marks, 0)) AS obtained,
           e.total_marks AS total,
           e.passing_marks AS passing,
           COALESCE(NULLIF(trim(sub.name), ''), 'Unspecified') AS subject,
           er.marks_obtained,
           er.grace_marks,
           e.passing_marks
      FROM exam_results er
      JOIN exams e
        ON e.workspace_subdomain = er.workspace_subdomain
       AND e.id = er.exam_id
       AND e.deleted_at IS NULL
      LEFT JOIN subjects sub
        ON sub.workspace_subdomain = e.workspace_subdomain
       AND sub.id = e.subject_id
     WHERE er.workspace_subdomain = ${subdomain}
       AND e.total_marks > 0
       ${publishedOnlyFilter(publishedOnly)}
  )`;
}

export async function loadExaminationsAnalytics(
  tenant: string,
  options?: { publishedOnly?: boolean },
): Promise<ExaminationsReportAnalytics> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) {
    return { subjectPassRates: [], gradeDistribution: [], topPerformers: [], sectionAverages: [] };
  }
  const cte = scoredCte(subdomain, options?.publishedOnly);
  return withTenantRead(subdomain, async (tx) => {
    const subjectRows = await tx.execute(
      sql`${cte}
        SELECT subject,
               count(*)::int AS total,
               count(*) FILTER (WHERE obtained >= passing) AS passed
          FROM scored
         GROUP BY subject
         ORDER BY count(*) DESC, subject ASC
         LIMIT 20`,
    );

    const gradeRows = await tx.execute(
      sql`${cte}
        SELECT ${gradeCaseSql()} AS grade, count(*)::int AS count
          FROM exam_results er
          JOIN exams e
            ON e.workspace_subdomain = er.workspace_subdomain
           AND e.id = er.exam_id
           AND e.deleted_at IS NULL
         WHERE er.workspace_subdomain = ${subdomain}
           AND e.total_marks > 0
           ${publishedOnlyFilter(options?.publishedOnly)}
         GROUP BY 1`,
    );

    const topRows = await tx.execute(
      sql`${cte}
        SELECT student_id AS "studentId",
               round((avg(obtained * 100.0 / total))::numeric, 2) AS "averagePct",
               count(*)::int AS exams
          FROM scored
         GROUP BY student_id
         ORDER BY "averagePct" DESC, "exams" DESC, student_id ASC
         LIMIT 10`,
    );

    const sectionRows = await tx.execute(
      sql`${cte}
        SELECT COALESCE(NULLIF(trim(sc.name), ''), 'Unassigned') AS label,
               count(*)::int AS total,
               round((avg(scored.obtained * 100.0 / scored.total))::numeric, 2) AS "averagePct"
          FROM scored
          JOIN exam_classes ec
            ON ec.workspace_subdomain = ${subdomain}
           AND ec.exam_id = scored.exam_id
          JOIN enrollments en
            ON en.workspace_subdomain = ${subdomain}
           AND en.class_id = ec.class_id
           AND en.student_id = scored.student_id
           AND en.deleted_at IS NULL
          LEFT JOIN session_classes sc
            ON sc.workspace_subdomain = ${subdomain}
           AND sc.id = en.class_id
         GROUP BY 1
         ORDER BY "averagePct" DESC
         LIMIT 10`,
    );

    const counts = new Map<string, number>();
    for (const row of getQueryRows<Record<string, unknown>>(gradeRows)) {
      counts.set(String(row.grade), Number(row.count ?? 0));
    }
    const gradeDistribution = GRADE_BANDS.map((band) => ({
      grade: band.label,
      count: counts.get(band.label) ?? 0,
    }));

    return {
      subjectPassRates: getQueryRows<Record<string, unknown>>(subjectRows).map((row) => {
        const total = Number(row.total ?? 0);
        const passed = Number(row.passed ?? 0);
        return {
          subject: String(row.subject ?? "Unspecified"),
          total,
          passed,
          passRatePct: total > 0 ? Math.round((passed / total) * 100) : 0,
        };
      }),
      gradeDistribution,
      topPerformers: getQueryRows<Record<string, unknown>>(topRows).map((row) => ({
        studentId: String(row.studentId),
        averagePct: Number(row.averagePct ?? 0),
        exams: Number(row.exams ?? 0),
      })),
      sectionAverages: getQueryRows<Record<string, unknown>>(sectionRows).map((row) => ({
        label: String(row.label ?? "Unassigned"),
        total: Number(row.total ?? 0),
        averagePct: Number(row.averagePct ?? 0),
      })),
    };
  });
}
