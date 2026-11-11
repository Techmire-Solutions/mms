import { sql, type SQL } from "drizzle-orm";
import { GRADE_BANDS, LOWEST_GRADE_BAND, type ExaminationsReportAnalytics } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";

/**
 * Examinations analytics: subject pass/fail, grade distribution, top performers, section averages.
 *
 * One tenant-scoped statement over `exam_results` ⋈ `exams` (both indexed by workspace; exams by
 * date/status/active). The `scored` CTE is MATERIALIZED so the marks join runs once and all four
 * aggregates read the same rows — the previous implementation issued four statements, each
 * re-scanning every mark in the tenant. Grade buckets are generated from the shared `GRADE_BANDS`,
 * so the histogram can never disagree with the letter printed on a report card. Percentage uses the
 * effective score (marks + grace), and a failed result is always `F` — the same rule as
 * `resolveResultScore`.
 */

/** Percent expression over the `scored` CTE. `total > 0` is filtered in the CTE. */
const PCT = sql`(obtained * 100.0 / total)`;

function gradeCaseSql(): SQL {
  const nonFail = GRADE_BANDS.filter((band) => band.label !== LOWEST_GRADE_BAND.label);
  const whens = nonFail.map((band) => sql`WHEN ${PCT} >= ${band.minPct} THEN ${band.label}`);
  return sql`CASE WHEN obtained >= passing
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
function publishedOnlyFilter(value: boolean | undefined): SQL {
  return value ? sql`AND e.results_finalized_at IS NOT NULL` : sql``;
}

function scoredCte(subdomain: string, publishedOnly?: boolean): SQL {
  return sql`WITH scored AS MATERIALIZED (
    SELECT er.student_id AS student_id,
           er.exam_id AS exam_id,
           (er.marks_obtained + COALESCE(er.grace_marks, 0)) AS obtained,
           e.total_marks AS total,
           e.passing_marks AS passing,
           COALESCE(NULLIF(trim(sub.name), ''), 'Unspecified') AS subject
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

/**
 * Four aggregates in one statement: a `kind` discriminator plus a `sort` column so each branch
 * keeps its intended order across the UNION.
 */
function analyticsSql(subdomain: string, publishedOnly?: boolean): SQL {
  return sql`${scoredCte(subdomain, publishedOnly)},
  subject_agg AS (
    SELECT subject AS name,
           count(*)::int AS total,
           count(*) FILTER (WHERE obtained >= passing)::int AS passed,
           row_number() OVER (ORDER BY count(*) DESC, subject ASC) AS sort
      FROM scored
     GROUP BY subject
  ),
  grade_agg AS (
    SELECT ${gradeCaseSql()} AS name, count(*)::int AS total
      FROM scored
     GROUP BY 1
  ),
  top_agg AS (
    SELECT student_id AS name,
           count(*)::int AS total,
           round((avg(${PCT}))::numeric, 2) AS metric,
           row_number() OVER (
             ORDER BY avg(${PCT}) DESC, count(*) DESC, student_id ASC
           ) AS sort
      FROM scored
     GROUP BY student_id
  ),
  section_agg AS (
    SELECT COALESCE(NULLIF(trim(sc.name), ''), 'Unassigned') AS name,
           count(*)::int AS total,
           round((avg(${PCT}))::numeric, 2) AS metric,
           row_number() OVER (ORDER BY avg(${PCT}) DESC) AS sort
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
  )
  SELECT 'subject'::text AS kind, name, total, passed, NULL::numeric AS metric, sort
    FROM subject_agg WHERE sort <= 20
  UNION ALL
  SELECT 'grade'::text AS kind, name, total, NULL::int AS passed, NULL::numeric AS metric,
         row_number() OVER (ORDER BY name) AS sort
    FROM grade_agg
  UNION ALL
  SELECT 'top'::text AS kind, name, total, NULL::int AS passed, metric, sort
    FROM top_agg WHERE sort <= 10
  UNION ALL
  SELECT 'section'::text AS kind, name, total, NULL::int AS passed, metric, sort
    FROM section_agg WHERE sort <= 10
  ORDER BY kind, sort`;
}

export async function loadExaminationsAnalytics(
  tenant: string,
  options?: { publishedOnly?: boolean },
): Promise<ExaminationsReportAnalytics> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain) {
    return { subjectPassRates: [], gradeDistribution: [], topPerformers: [], sectionAverages: [] };
  }

  return withTenantRead(subdomain, async (tx) => {
    const rows = getQueryRows<Record<string, unknown>>(
      await tx.execute(analyticsSql(subdomain, options?.publishedOnly)),
    );

    const subjectPassRates: ExaminationsReportAnalytics["subjectPassRates"] = [];
    const gradeCounts = new Map<string, number>();
    const topPerformers: ExaminationsReportAnalytics["topPerformers"] = [];
    const sectionAverages: ExaminationsReportAnalytics["sectionAverages"] = [];

    for (const row of rows) {
      const total = Number(row.total ?? 0);
      switch (String(row.kind)) {
        case "subject": {
          const passed = Number(row.passed ?? 0);
          subjectPassRates.push({
            subject: String(row.name ?? "Unspecified"),
            total,
            passed,
            passRatePct: total > 0 ? Math.round((passed / total) * 100) : 0,
          });
          break;
        }
        case "grade":
          gradeCounts.set(String(row.name), total);
          break;
        case "top":
          topPerformers.push({
            studentId: String(row.name),
            averagePct: Number(row.metric ?? 0),
            exams: total,
          });
          break;
        case "section":
          sectionAverages.push({
            label: String(row.name ?? "Unassigned"),
            total,
            averagePct: Number(row.metric ?? 0),
          });
          break;
        default:
          break;
      }
    }

    return {
      subjectPassRates,
      gradeDistribution: GRADE_BANDS.map((band) => ({
        grade: band.label,
        count: gradeCounts.get(band.label) ?? 0,
      })),
      topPerformers,
      sectionAverages,
    };
  });
}
