import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  type SQL,
  type AnyColumn,
  asc,
  desc,
  sql,
} from "drizzle-orm";
import {
  dedupeTrimmedIds,
  isQueryFlagTrue,
  toSqlSearchPattern,
  type QuestionBankCommandMetricsSnapshot,
  type QuestionBankListQuery,
  type QuestionBankListPageResult,
} from "@mms/shared";
import {
  assessmentResults,
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
  tests,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { questionRowToRecord } from "./questionBankRepository.js";

function buildQuestionsListConditions(subdomain: string, query: QuestionBankListQuery): SQL[] {
  const conditions: SQL[] = [eq(questions.workspaceSubdomain, subdomain)];

  if (isQueryFlagTrue(query.includeDeleted)) {
    conditions.push(isNotNull(questions.deletedAt));
  } else {
    conditions.push(isNull(questions.deletedAt));
  }

  const search = query.search?.trim();
  if (search) {
    conditions.push(ilike(questions.text, toSqlSearchPattern(search)));
  }

  const categoryIds = dedupeTrimmedIds(query.categoryId);
  if (categoryIds.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${questionCategories}
        WHERE ${questionCategories.workspaceSubdomain} = ${subdomain}
          AND ${questionCategories.questionId} = ${questions.id}
          AND ${inArray(questionCategories.categoryId, categoryIds)}
      )`,
    );
  }

  const difficulties = dedupeTrimmedIds(query.difficulty);
  if (difficulties.length) {
    conditions.push(inArray(questions.difficulty, difficulties));
  }

  return conditions;
}

const QUESTION_SORT_FIELDS = new Set([
  "text",
  "difficulty",
  "type",
  "questionLanguage",
  "updatedAt",
  "createdAt",
]);

function buildQuestionsOrderBy(sortField?: string, sortDir?: "asc" | "desc" | ""): SQL {
  const field = sortField?.trim();
  let column: AnyColumn = questions.updatedAt;
  if (field && QUESTION_SORT_FIELDS.has(field)) {
    switch (field) {
      case "createdAt":
        column = questions.createdAt;
        break;
      case "text":
        column = questions.text;
        break;
      case "difficulty":
        column = questions.difficulty;
        break;
      case "type":
        column = questions.type;
        break;
      case "questionLanguage":
        column = questions.questionLanguage;
        break;
      case "updatedAt":
      default:
        column = questions.updatedAt;
    }
  }
  return sortDir === "asc" ? asc(column) : desc(column);
}

export async function listQuestionsPage(
  tenant: string,
  query: QuestionBankListQuery & { afterId?: string; skipCount?: boolean },
): Promise<QuestionBankListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, questions, {
      conditions: buildQuestionsListConditions(subdomain, query),
      orderBy: buildQuestionsOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 15,
      rowMapper: (row) => row as typeof questions.$inferSelect,
    });

    if (result.items.length === 0) {
      return {
        questions: [],
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: false,
      };
    }

    const qIds = result.items.map((r) => r.id);
    const [allCats, allOpts, allTags, allCits] = await Promise.all([
      tx
        .select({
          questionId: questionCategories.questionId,
          categoryId: questionCategories.categoryId,
        })
        .from(questionCategories)
        .where(
          and(
            eq(questionCategories.workspaceSubdomain, subdomain),
            inArray(questionCategories.questionId, qIds),
          ),
        ),
      tx
        .select({
          questionId: questionOptions.questionId,
          optionIndex: questionOptions.optionIndex,
          optionText: questionOptions.optionText,
        })
        .from(questionOptions)
        .where(
          and(
            eq(questionOptions.workspaceSubdomain, subdomain),
            inArray(questionOptions.questionId, qIds),
          ),
        ),
      tx
        .select({
          questionId: questionTags.questionId,
          tag: questionTags.tag,
        })
        .from(questionTags)
        .where(
          and(
            eq(questionTags.workspaceSubdomain, subdomain),
            inArray(questionTags.questionId, qIds),
          ),
        ),
      tx
        .select({
          questionId: questionCitations.questionId,
          bookId: questionCitations.bookId,
          citation: questionCitations.citation,
        })
        .from(questionCitations)
        .where(
          and(
            eq(questionCitations.workspaceSubdomain, subdomain),
            inArray(questionCitations.questionId, qIds),
          ),
        ),
    ]);

    const catsByQ = new Map<string, string[]>();
    for (const c of allCats) {
      const arr = catsByQ.get(c.questionId) ?? [];
      arr.push(c.categoryId);
      catsByQ.set(c.questionId, arr);
    }

    const optsByQ = new Map<string, Array<{ index: number; text: string }>>();
    for (const o of allOpts) {
      const arr = optsByQ.get(o.questionId) ?? [];
      arr.push({ index: o.optionIndex, text: o.optionText });
      optsByQ.set(o.questionId, arr);
    }

    const tagsByQ = new Map<string, string[]>();
    for (const t of allTags) {
      const arr = tagsByQ.get(t.questionId) ?? [];
      arr.push(t.tag);
      tagsByQ.set(t.questionId, arr);
    }

    const citsByQ = new Map<string, Array<{ bookId: string; citation: Record<string, unknown> }>>();
    for (const ci of allCits) {
      const arr = citsByQ.get(ci.questionId) ?? [];
      let parsedCit: Record<string, unknown> = {};
      try {
        parsedCit = JSON.parse(ci.citation || "{}");
      } catch {
        // ignore
      }
      arr.push({ bookId: ci.bookId, citation: parsedCit });
      citsByQ.set(ci.questionId, arr);
    }

    const items = result.items.map((r) => {
      const sortedOpts = (optsByQ.get(r.id) ?? [])
        .sort((a, b) => a.index - b.index)
        .map((o) => o.text);
      return questionRowToRecord(
        r,
        catsByQ.get(r.id) ?? [],
        sortedOpts,
        tagsByQ.get(r.id) ?? [],
        citsByQ.get(r.id) ?? [],
      );
    });

    return {
      questions: items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

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
