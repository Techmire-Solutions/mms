import type { Distribution } from "./hasanatModuleManifest.js";

/** Query accepted by the hasanat distributions list endpoint. */
export interface HasanatListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated distribution statuses (`active|redeemed|returned`). */
  status?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
}

/** Paginated hasanat distributions response. */
export interface HasanatDistributionsListPageResult {
  distributions: Distribution[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
