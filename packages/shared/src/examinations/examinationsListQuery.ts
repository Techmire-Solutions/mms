import type { Exam } from "./examinationsModuleManifest.js";

/** Query accepted by the examinations exams list endpoint. */
export interface ExaminationsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated exam statuses (`upcoming|ongoing|completed|scheduled|cancelled`). */
  status?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

/** Paginated examinations exams response. */
export interface ExaminationsListPageResult {
  exams: Exam[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
