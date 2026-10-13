import type { QuestionBankQuestion } from "./questionBankEntities.js";

/** Query accepted by the question bank questions list endpoint. */
export interface QuestionBankListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated category ids (JSONB array overlap match on `categoryIds`). */
  categoryId?: string;
  /** Comma-separated difficulties (`easy|medium|hard`). */
  difficulty?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

/** Paginated question bank questions response. */
export interface QuestionBankListPageResult {
  questions: QuestionBankQuestion[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
