import {
  STUDENTS_MODULE_MANIFEST,
  type StudentRecord,
  type StudentsListPageResult,
  type StudentsListQuery,
} from "@mms/shared";
import { createModuleListQueryBuilders } from "@/lib/query/createModuleListQueryBuilders";
import {
  STUDENTS_API,
  STUDENTS_QUERY_KEY,
} from "@/tenant/features/students/hooks/studentsQueryKeys";

export type { StudentRecord, StudentsListPageResult };

/** Work list Query params — shared {@link StudentsListQuery} + FE-only `enabled`. */
export type StudentsPaginatedParams = StudentsListQuery & {
  page: number;
  enabled?: boolean;
};

const builders = createModuleListQueryBuilders<StudentsPaginatedParams>({
  resolveApiPath: () => STUDENTS_API,
  resolveQueryKey: () => STUDENTS_QUERY_KEY,
  defaultPageSize: STUDENTS_MODULE_MANIFEST.defaultPageSize,
  keyStyle: "include",
  fields: [
    { name: "search", kind: "text", keyDefault: "" },
    { name: "status", kind: "text", keyDefault: "" },
    { name: "gender", kind: "text", keyDefault: "" },
    { name: "quickFilter", kind: "enum", keyDefault: "all", allValue: "all" },
    { name: "sortField", kind: "text", keyDefault: "" },
    { name: "sortDir", kind: "text", keyDefault: "" },
    { name: "includeDeleted", kind: "boolean", keyDefault: false },
    { name: "sessionId", kind: "text", keyDefault: "" },
    { name: "className", kind: "text", keyDefault: "" },
  ],
});

export const buildStudentsPageUrl = builders.buildPageUrl;
export const studentsListQueryKeyParams = builders.listQueryKeyParams;
export const studentsPaginatedQueryKey = builders.paginatedQueryKey;
export const sameStudentsListFilters = builders.sameListFilters;
