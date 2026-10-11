import { and, eq, isNull, sql } from "drizzle-orm";
import type { QuestionBankReportAggregates } from "@mms/shared";
import {
  questions,
  questionCategories,
  tests,
  assessmentResults,
  assessmentAnswers,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

const VALID_DIFFICULTIES_SET = new Set(["easy", "medium", "hard"]);

export type QuestionBankReportQuery = {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
};

/** SQL aggregates for Question Bank Reports tier. */
export async function aggregateQuestionBankReport(
  tenant: string,
  query: QuestionBankReportQuery = {},
): Promise<QuestionBankReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const activeQuestions = and(
      eq(questions.workspaceSubdomain, subdomain),
      isNull(questions.deletedAt),
      query.categoryId
        ? sql`EXISTS (
            SELECT 1 FROM question_categories qc
            WHERE qc.workspace_subdomain = ${questions.workspaceSubdomain}
              AND qc.question_id = ${questions.id}
              AND qc.category_id = ${query.categoryId}
          )`
        : undefined,
    );

    // Total counts
    const [questionsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(activeQuestions);

    const [testsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), isNull(tests.deletedAt)));

    const activeResults = and(
      eq(assessmentResults.workspaceSubdomain, subdomain),
      isNull(assessmentResults.deletedAt),
      query.dateFrom
        ? sql`(${assessmentResults.submittedAt})::date >= ${query.dateFrom}::date`
        : undefined,
      query.dateTo
        ? sql`(${assessmentResults.submittedAt})::date <= ${query.dateTo}::date`
        : undefined,
    );

    const [resultsRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(assessmentResults)
      .where(activeResults);

    // Average score per result (sum of answer scores / count of results)
    const [avgRow] = await tx
      .select({
        avgScore: sql<number>`coalesce(avg(sub.total_score), 0)::float8`,
      })
      .from(
        tx
          .select({
            resultId: assessmentAnswers.resultId,
            total_score: sql<number>`sum(${assessmentAnswers.score})`.as("total_score"),
          })
          .from(assessmentAnswers)
          .where(eq(assessmentAnswers.workspaceSubdomain, subdomain))
          .groupBy(assessmentAnswers.resultId)
          .as("sub"),
      );

    // Pass rate: percentage of tests where student score >= test.totalMarks * 0.5
    const [passRow] = await tx
      .select({
        passCount: sql<number>`count(*) FILTER (
          WHERE sub.total_score >= (t.total_marks * 0.5)
        )::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(
        tx
          .select({
            resultId: assessmentResults.id,
            testId: assessmentResults.testId,
            total_score: sql<number>`coalesce(sum(${assessmentAnswers.score}), 0)`.as(
              "total_score",
            ),
          })
          .from(assessmentResults)
          .leftJoin(assessmentAnswers, eq(assessmentResults.id, assessmentAnswers.resultId))
          .where(activeResults)
          .groupBy(assessmentResults.id, assessmentResults.testId)
          .as("sub"),
      )
      .leftJoin(tests, eq(sql`sub.test_id`, tests.id));

    const passCount = Number(passRow?.passCount ?? 0);
    const totalCount = Number(passRow?.totalCount ?? 0);
    const passRate = totalCount > 0 ? (passCount / totalCount) * 100 : 0;

    // Category breakdown
    const categoryRows = await tx
      .select({
        categoryId: questionCategories.categoryId,
        categoryName: questionCategories.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(questionCategories)
      .innerJoin(
        questions,
        and(
          eq(questionCategories.questionId, questions.id),
          eq(questionCategories.workspaceSubdomain, questions.workspaceSubdomain),
        ),
      )
      .where(activeQuestions)
      .groupBy(questionCategories.categoryId);

    // Difficulty breakdown
    const difficultyRows = await tx
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(activeQuestions)
      .groupBy(questions.difficulty);

    // Monthly results trend (last 12 months)
    const monthlyRows = await tx
      .select({
        monthKey: sql<string>`to_char((${assessmentResults.submittedAt})::date, 'YYYY-MM')`,
        resultsCount: sql<number>`count(*)::int`,
        averageScore: sql<number>`coalesce(avg(ans_sub.total_score), 0)::float8`,
      })
      .from(assessmentResults)
      .leftJoin(
        tx
          .select({
            resultId: assessmentAnswers.resultId,
            total_score: sql<number>`sum(${assessmentAnswers.score})`.as("total_score"),
          })
          .from(assessmentAnswers)
          .where(eq(assessmentAnswers.workspaceSubdomain, subdomain))
          .groupBy(assessmentAnswers.resultId)
          .as("ans_sub"),
        eq(assessmentResults.id, sql`ans_sub.result_id`),
      )
      .where(
        and(
          activeResults,
          sql`(${assessmentResults.submittedAt})::date >= (now() - interval '12 months')::date`,
        ),
      )
      .groupBy(sql`to_char((${assessmentResults.submittedAt})::date, 'YYYY-MM')`)
      .orderBy(sql`to_char((${assessmentResults.submittedAt})::date, 'YYYY-MM') ASC`);

    const monthlyResults: { monthKey: string; resultsCount: number; averageScore: number }[] = [];
    for (let i = 0; i < monthlyRows.length; i++) {
      const r = monthlyRows[i];
      if (r.monthKey) {
        monthlyResults.push({
          monthKey: r.monthKey,
          resultsCount: Number(r.resultsCount),
          averageScore: Number(r.averageScore),
        });
      }
    }

    return {
      totalQuestions: Number(questionsRow?.count ?? 0),
      totalTests: Number(testsRow?.count ?? 0),
      totalResults: Number(resultsRow?.count ?? 0),
      averageScore: Number(avgRow?.avgScore ?? 0),
      passRate,
      categoryBreakdown: categoryRows.map((r) => ({
        categoryId: r.categoryId ?? "",
        categoryName: r.categoryName ?? r.categoryId ?? "Uncategorized",
        questionCount: Number(r.count),
      })),
      difficultyBreakdown: difficultyRows.map((r) => ({
        difficulty: VALID_DIFFICULTIES_SET.has(r.difficulty ?? "")
          ? (r.difficulty as "easy" | "medium" | "hard")
          : "unset",
        questionCount: Number(r.count),
      })),
      monthlyResults,
    };
  });
}
