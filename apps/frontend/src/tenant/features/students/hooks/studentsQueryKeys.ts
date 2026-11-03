import {
  STUDENTS_MODULE_MANIFEST,
  type StudentsListQuery,
  type StudentsWidgetQuery,
} from "@mms/shared";

export type { StudentRecord, StudentsListPageResult } from "@mms/shared";

export const STUDENTS_QUERY_KEY = [STUDENTS_MODULE_MANIFEST.collectionKey, "list"] as const;
export const STUDENTS_METRICS_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "metrics",
] as const;
export const STUDENTS_WIDGET_AGGREGATES_QUERY_KEY = [
  STUDENTS_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;

/** Work list Query params — shared {@link StudentsListQuery} + FE-only `enabled`. */
export type StudentsPaginatedParams = StudentsListQuery & {
  page: number;
  enabled?: boolean;
};

/** Contract query for the Work / picker list fetches. */
export interface StudentsContractQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  className?: string;
  relatedContactIds?: string;
  fatherName?: string;
  excludeId?: string;
  afterId?: string;
  skipCount?: boolean;
  [key: string]: unknown;
}

/** The single Students list cache key — one key shape, one fetcher (`useStudentsContractList`). */
export function studentsListQueryKey(query: StudentsContractQueryParams = {}): readonly unknown[] {
  return [...STUDENTS_QUERY_KEY, "contract", query];
}

export interface StudentNextGrNumberParams {
  registeredDate: string;
  template?: string;
  digits?: number;
  restartAnnually?: boolean;
  enabled?: boolean;
}

/** Widget aggregate request — shared query + FE collection filter. */
export type StudentsWidgetAggregateWidgetInput = StudentsWidgetQuery & {
  collection: string;
};
