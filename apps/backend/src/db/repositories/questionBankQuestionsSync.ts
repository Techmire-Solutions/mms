import { and, eq, inArray } from "drizzle-orm";
import { type QuestionBankQuestion } from "@mms/shared";
import {
  type questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
} from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

type QuestionRow = typeof questions.$inferSelect;
type Transaction = TenantTransaction;

export function questionRowToRecord(
  row: QuestionRow,
  categories: string[] = [],
  options: string[] = [],
  tags: string[] = [],
  citations: Array<{ bookId: string; citation: Record<string, unknown> }> = [],
): QuestionBankQuestion {
  const audit = mapAuditTimestamps(row);
  const question: QuestionBankQuestion = {
    id: row.id,
    categoryIds: categories,
    type: row.type as QuestionBankQuestion["type"],
    difficulty: row.difficulty as QuestionBankQuestion["difficulty"],
    questionLanguage: row.questionLanguage as QuestionBankQuestion["questionLanguage"],
    text: row.text,
    options,
    answer: row.answer,
    marks: row.marks,
    deletedAt: audit.deletedAt ?? null,
    deletedBy: audit.deletedBy ?? null,
    deletionReason: audit.deletionReason ?? null,
  };

  if (categories[0]) question.categoryId = categories[0];
  if (tags.length > 0) question.tags = tags;
  if (citations.length > 0) question.sourceCitations = citations;

  return question;
}

export async function syncQuestionChildren(
  tx: Transaction,
  subdomain: string,
  record: QuestionBankQuestion,
): Promise<void> {
  await Promise.all([
    tx
      .delete(questionCategories)
      .where(
        and(
          eq(questionCategories.workspaceSubdomain, subdomain),
          eq(questionCategories.questionId, record.id),
        ),
      ),
    tx
      .delete(questionOptions)
      .where(
        and(
          eq(questionOptions.workspaceSubdomain, subdomain),
          eq(questionOptions.questionId, record.id),
        ),
      ),
    tx
      .delete(questionTags)
      .where(
        and(eq(questionTags.workspaceSubdomain, subdomain), eq(questionTags.questionId, record.id)),
      ),
    tx
      .delete(questionCitations)
      .where(
        and(
          eq(questionCitations.workspaceSubdomain, subdomain),
          eq(questionCitations.questionId, record.id),
        ),
      ),
  ]);

  const catIds = record.categoryIds ?? (record.categoryId ? [record.categoryId] : []);
  if (catIds.length > 0) {
    await tx.insert(questionCategories).values(
      catIds.map((catId) => ({
        workspaceSubdomain: subdomain,
        questionId: record.id,
        categoryId: catId,
      })),
    );
  }

  if (record.options && record.options.length > 0) {
    await tx.insert(questionOptions).values(
      record.options.map((opt, i) => ({
        id: `${record.id}_opt_${i}`,
        workspaceSubdomain: subdomain,
        questionId: record.id,
        optionIndex: i,
        optionText: opt,
      })),
    );
  }

  if (record.tags && record.tags.length > 0) {
    await tx.insert(questionTags).values(
      record.tags.map((tag) => ({
        workspaceSubdomain: subdomain,
        questionId: record.id,
        tag,
      })),
    );
  }

  if (record.sourceCitations && record.sourceCitations.length > 0) {
    await tx.insert(questionCitations).values(
      record.sourceCitations.map((cit, i) => ({
        id: `${record.id}_cit_${i}`,
        workspaceSubdomain: subdomain,
        questionId: record.id,
        bookId: cit.bookId,
        citation: JSON.stringify(cit.citation ?? {}),
      })),
    );
  }
}

export async function hydrateQuestionRecords(
  tx: Transaction,
  subdomain: string,
  rows: QuestionRow[],
): Promise<QuestionBankQuestion[]> {
  if (rows.length === 0) return [];
  const qIds = rows.map((r) => r.id);

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
        and(eq(questionTags.workspaceSubdomain, subdomain), inArray(questionTags.questionId, qIds)),
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

  const optsByQ = new Map<string, Array<{ optionIndex: number; optionText: string }>>();
  for (const o of allOpts) {
    const arr = optsByQ.get(o.questionId) ?? [];
    arr.push(o);
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
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(ci.citation || "{}");
    } catch {
      // ignore
    }
    const arr = citsByQ.get(ci.questionId) ?? [];
    arr.push({ bookId: ci.bookId, citation: parsed });
    citsByQ.set(ci.questionId, arr);
  }

  return rows.map((r) => {
    const sortedOpts = (optsByQ.get(r.id) ?? [])
      .sort((a, b) => a.optionIndex - b.optionIndex)
      .map((o) => o.optionText);
    return questionRowToRecord(
      r,
      catsByQ.get(r.id) ?? [],
      sortedOpts,
      tagsByQ.get(r.id) ?? [],
      citsByQ.get(r.id) ?? [],
    );
  });
}
