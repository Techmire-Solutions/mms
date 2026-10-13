import { FACULTY_MODULE_MANIFEST, type FacultyWidgetQuery } from "@mms/shared";

export const FACULTY_QUERY_KEY = [FACULTY_MODULE_MANIFEST.collectionKey, "list"] as const;
export const FACULTY_METRICS_QUERY_KEY = [
  FACULTY_MODULE_MANIFEST.collectionKey,
  "metrics",
] as const;
export const FACULTY_WIDGET_AGGREGATES_QUERY_KEY = [
  FACULTY_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;

export const FACULTY_API = FACULTY_MODULE_MANIFEST.restBasePath;

/** Page/filter URL builders + key helpers live beside the query keys (Students parity). */
export {
  buildFacultyPageUrl,
  facultyListQueryKeyParams,
  facultyPaginatedQueryKey,
  sameFacultyListFilters,
} from "./facultyListQueryBuilders";
export type {
  FacultyRecord,
  FacultyListPageResult,
  FacultyPaginatedParams,
} from "./facultyListQueryBuilders";

export interface FacultyNextEmployeeIdParams {
  prefix?: string;
  template?: string;
  digits?: number;
  startSeq?: number;
  restartAnnually?: boolean;
  enabled?: boolean;
}

/** Widget aggregate request — shared query + FE collection filter. */
export type FacultyWidgetAggregateWidgetInput = FacultyWidgetQuery & {
  collection: string;
};
