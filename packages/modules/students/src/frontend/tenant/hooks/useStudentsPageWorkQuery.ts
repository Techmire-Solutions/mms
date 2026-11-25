import { STUDENTS_MODULE_MANIFEST, type Student, type StudentsQuickFilter } from "@mms/contracts";
import { useStudentsContractList } from "./useStudentsQueries";
import type { StudentsListContentSortField } from "../lib/studentsListTypes";
import { contractBody, isContractQueryError } from "@mms/fe-core/api/contractQuery";

const SORT_FIELD_TO_API: Record<StudentsListContentSortField, string> = {
  name: "name",
  dob: "dob",
  status: "status",
  grNumber: "grNumber",
  gender: "gender",
  registeredDate: "registeredDate",
  studentId: "studentId",
  updatedAt: "updatedAt",
};

type StudentsPageWorkQueryInput = {
  enabled: boolean;
  listPage: number;
  debouncedSearch: string;
  studentFilterStatus: string[];
  studentFilterGender: string;
  quickFilter: StudentsQuickFilter;
  sortField: StudentsListContentSortField | null;
  sortDir: "asc" | "desc";
  viewingDeleted: boolean;
};

/** Paginated Students Work query + derived list rows/count. */
export function useStudentsPageWorkQuery({
  enabled,
  listPage,
  debouncedSearch,
  studentFilterStatus,
  studentFilterGender,
  quickFilter,
  sortField,
  sortDir,
  viewingDeleted,
}: StudentsPageWorkQueryInput) {
  const workLimit = STUDENTS_MODULE_MANIFEST.defaultPageSize;

  const workPageQuery = useStudentsContractList(
    {
      page: listPage,
      limit: workLimit,
      search: debouncedSearch,
      status: studentFilterStatus.length > 0 ? studentFilterStatus.join(",") : undefined,
      gender: studentFilterGender || undefined,
      quickFilter: quickFilter === "all" ? undefined : quickFilter,
      sortField: sortField ? SORT_FIELD_TO_API[sortField] : undefined,
      sortDir: sortField ? sortDir : undefined,
      includeDeleted: viewingDeleted,
    },
    enabled,
  );

  const workStudents = (() => (workPageQuery.data?.body?.students ?? []) as Student[])();
  const shownCount = workPageQuery.data?.body?.total ?? 0;

  const isWorkError = isContractQueryError(workPageQuery);

  // The contract list returns a `{ status, body }` envelope; expose the body as
  // `.data` so consumers see the same shape as a plain Query result.
  const workPageQueryPatched = {
    ...workPageQuery,
    isError: isWorkError,
    data: contractBody<NonNullable<typeof workPageQuery.data>["body"]>(
      workPageQuery.data ?? undefined,
    ),
  };

  return {
    workPageQuery: workPageQueryPatched,
    workStudents,
    shownCount,
  };
}
