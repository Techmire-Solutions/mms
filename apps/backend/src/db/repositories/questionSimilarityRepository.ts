import { and, eq, inArray, sql } from "drizzle-orm";
import { questionSimilarity, SIMILAR_THRESHOLD } from "@mms/shared";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { questionCategories } from "../schema.js";

/**
 * Candidate lookup for duplicate detection (migration 0242 follow-up).
 *
 * The database does the narrowing (`text % $q` uses the trigram index added in 0240), then the shared
 * deterministic scorer re-ranks the candidates so the reported score is independent of
 * `pg_trgm.similarity_threshold`. When `pg_trgm` is unavailable the query falls back to an ILIKE on
 * the longest token, so the feature degrades instead of failing.
 */

export interface SimilarQuestionRow {
  id: string;
  text: string;
  difficulty: string;
  categoryIds: string[];
  score: number;
}

interface RawCandidate extends Record<string, unknown> {
  id: string;
  text: string;
  difficulty: string;
}

async function loadCandidates(
  tx: TenantTransaction,
  subdomain: string,
  input: { text: string; excludeId?: string; limit: number },
): Promise<RawCandidate[]> {
  try {
    const result = await tx.execute<RawCandidate>(sql`
      SELECT q.id, q.text, q.difficulty
        FROM questions q
       WHERE q.workspace_subdomain = ${subdomain}
         AND q.deleted_at IS NULL
         AND q.text % ${input.text}
         ${input.excludeId ? sql`AND q.id <> ${input.excludeId}` : sql``}
       ORDER BY similarity(q.text, ${input.text}) DESC
       LIMIT ${input.limit}
    `);
    return result.rows;
  } catch {
    // pg_trgm missing/unavailable — narrow on the longest token instead.
    const token = input.text
      .split(/\s+/)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)[0];
    if (!token) return [];
    const result = await tx.execute<RawCandidate>(sql`
      SELECT q.id, q.text, q.difficulty
        FROM questions q
       WHERE q.workspace_subdomain = ${subdomain}
         AND q.deleted_at IS NULL
         AND q.text ILIKE ${`%${token}%`}
         ${input.excludeId ? sql`AND q.id <> ${input.excludeId}` : sql``}
       LIMIT ${input.limit}
    `);
    return result.rows;
  }
}

/** Ranked near-duplicates of `text`, highest similarity first. */
export async function findSimilarQuestions(
  tenant: string,
  input: { text: string; excludeId?: string; limit?: number },
): Promise<SimilarQuestionRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);

  return withTenant(subdomain, async (tx) => {
    const candidates = await loadCandidates(tx, subdomain, { ...input, limit: limit * 3 });
    if (candidates.length === 0) return [];

    const ids = candidates.map((candidate) => candidate.id);
    const categoryRows = await tx
      .select({
        questionId: questionCategories.questionId,
        categoryId: questionCategories.categoryId,
      })
      .from(questionCategories)
      .where(
        and(
          eq(questionCategories.workspaceSubdomain, subdomain),
          inArray(questionCategories.questionId, ids),
        ),
      );
    const categoriesByQuestion = new Map<string, string[]>();
    for (const row of categoryRows) {
      const list = categoriesByQuestion.get(row.questionId) ?? [];
      list.push(row.categoryId);
      categoriesByQuestion.set(row.questionId, list);
    }

    return candidates
      .map((candidate) => ({
        id: candidate.id,
        text: candidate.text,
        difficulty: candidate.difficulty,
        categoryIds: categoriesByQuestion.get(candidate.id) ?? [],
        score: questionSimilarity(input.text, candidate.text),
      }))
      .filter((candidate) => candidate.score >= SIMILAR_THRESHOLD)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  });
}
