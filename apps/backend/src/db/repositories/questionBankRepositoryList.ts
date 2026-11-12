import {
  and,
  eq,
  getTableColumns,
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
  type QuestionBankListQuery,
  type QuestionBankListPageResult,
} from "@mms/shared";
import {
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
} from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { questionRowToRecord } from "./questionBankRepository.js";

/**
 * Number of papers that reference a question. Correlated on
 * `test_questions_workspace_question_idx` (0240), so it is cheap for one row and opt-in for a list.
 */
const USAGE_COUNT_SQL = sql<number>`(
  SELECT count(*)::int FROM test_questions tq
   WHERE tq.workspace_subdomain = ${questions.workspaceSubdomain}
     AND tq.question_id = ${questions.id}
)`;
import { listQuestionAttachmentsTx } from "./questionBankAttachmentsRepository.js";

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

  if (query.type) conditions.push(eq(questions.type, query.type));
  if (query.status) conditions.push(eq(questions.status, query.status));

  const tag = query.tag?.trim();
  if (tag) {
    conditions.push(
      sql`exists (
        SELECT 1 FROM ${questionTags}
        WHERE ${questionTags.workspaceSubdomain} = ${subdomain}
          AND ${questionTags.questionId} = ${questions.id}
          AND ${questionTags.tag} = ${tag}
      )`,
    );
  }

  if (query.minUsage !== undefined) {
    conditions.push(sql`${USAGE_COUNT_SQL} >= ${query.minUsage}`);
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
  if (field === "usageCount") {
    return sortDir === "asc" ? asc(USAGE_COUNT_SQL) : desc(USAGE_COUNT_SQL);
  }
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
    // The usage count is opt-in: only pay for the correlated subquery when it is sorted/filtered on.
    const withUsage = query.sortField === "usageCount" || query.minUsage !== undefined;
    const result = await runListPage(tx, questions, {
      conditions: buildQuestionsListConditions(subdomain, query),
      orderBy: buildQuestionsOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 15,
      ...(withUsage
        ? { columns: { ...getTableColumns(questions), usageCount: USAGE_COUNT_SQL } }
        : {}),
      rowMapper: (row) => row as typeof questions.$inferSelect & { usageCount?: number },
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
    const [allCats, allOpts, allTags, allCits, attachmentsByQuestion] = await Promise.all([
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
      listQuestionAttachmentsTx(tx, subdomain, qIds),
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
      const record = questionRowToRecord(
        r,
        catsByQ.get(r.id) ?? [],
        sortedOpts,
        tagsByQ.get(r.id) ?? [],
        citsByQ.get(r.id) ?? [],
      );
      if (withUsage) {
        record.usageCount = Number((r as { usageCount?: number }).usageCount ?? 0);
      }
      const attachments = attachmentsByQuestion.get(r.id);
      if (attachments?.length) record.attachments = attachments;
      return record;
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
