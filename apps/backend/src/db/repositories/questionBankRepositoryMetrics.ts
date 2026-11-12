import { and, eq, isNull, sql } from "drizzle-orm";
import type { QuestionBankCommandMetricsSnapshot } from "@mms/shared";
import { assessmentResults, questions, tests } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/** Command-centre metrics (extracted from the list module to keep it under the line ceiling). */
/**
 * SQL aggregates for Question Bank command-centre metrics (active rows only).
 * `categories` is sourced from typed module preferences by the service caller.
 */
export async function aggregateQuestionBankCommandMetrics(
  tenant: string,
): Promise<QuestionBankCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const activeQuestions = and(
      eq(questions.workspaceSubdomain, subdomain),
      isNull(questions.deletedAt),
    );
    const qRows = await tx
      .select({
        total: sql<number>`count(*)::int`,
        easy: sql<number>`count(*) FILTER (WHERE ${questions.difficulty} = 'easy')::int`,
        medium: sql<number>`count(*) FILTER (WHERE ${questions.difficulty} = 'medium')::int`,
        hard: sql<number>`count(*) FILTER (WHERE ${questions.difficulty} = 'hard')::int`,
      })
      .from(questions)
      .where(activeQuestions);

    const [testRow] = await tx
      .select({ totalTests: sql<number>`count(*)::int` })
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), isNull(tests.deletedAt)));

    const [resultRow] = await tx
      .select({ totalResults: sql<number>`count(*)::int` })
      .from(assessmentResults)
      .where(
        and(
          eq(assessmentResults.workspaceSubdomain, subdomain),
          isNull(assessmentResults.deletedAt),
        ),
      );

    const row = qRows[0];
    return {
      total: Number(row?.total ?? 0),
      easy: Number(row?.easy ?? 0),
      medium: Number(row?.medium ?? 0),
      hard: Number(row?.hard ?? 0),
      totalTests: Number(testRow?.totalTests ?? 0),
      totalResults: Number(resultRow?.totalResults ?? 0),
      categories: 0,
    };
  });
}
