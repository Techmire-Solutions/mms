import {
  FACULTY_MODULE_MANIFEST,
  type FacultyRecord,
  type FacultyListPageResult,
  type FacultyListQuery,
} from "@mms/shared";
import { createModuleListQueryBuilders } from "@/lib/query/createModuleListQueryBuilders";
import { FACULTY_API, FACULTY_QUERY_KEY } from "@/tenant/features/faculty/hooks/facultyQueryKeys";

export type { FacultyRecord, FacultyListPageResult };

/** Work list Query params — shared {@link FacultyListQuery} + FE-only `enabled`. */
export type FacultyPaginatedParams = FacultyListQuery & {
  page: number;
  enabled?: boolean;
};

const builders = createModuleListQueryBuilders<FacultyPaginatedParams>({
  resolveApiPath: () => FACULTY_API,
  resolveQueryKey: () => FACULTY_QUERY_KEY,
  defaultPageSize: FACULTY_MODULE_MANIFEST.defaultPageSize,
  keyStyle: "include",
  fields: [
    { name: "search", kind: "text", keyDefault: "" },
    { name: "status", kind: "text", keyDefault: "" },
    { name: "specialization", kind: "text", keyDefault: "" },
    { name: "gender", kind: "text", keyDefault: "" },
    { name: "quickFilter", kind: "enum", keyDefault: "all", allValue: "all" },
    { name: "sortField", kind: "text", keyDefault: "" },
    { name: "sortDir", kind: "text", keyDefault: "" },
    { name: "department", kind: "text", keyDefault: "" },
    { name: "designation", kind: "text", keyDefault: "" },
    { name: "reportingFacultyId", kind: "text", keyDefault: "" },
    { name: "includeDeleted", kind: "boolean", keyDefault: false },
  ],
});

export const buildFacultyPageUrl = builders.buildPageUrl;
export const facultyListQueryKeyParams = builders.listQueryKeyParams;
export const facultyPaginatedQueryKey = builders.paginatedQueryKey;
export const sameFacultyListFilters = builders.sameListFilters;
