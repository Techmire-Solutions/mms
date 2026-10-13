import { STUDENTS_MODULE_MANIFEST, type Student, type StudentsQuickFilter } from "@mms/shared";
import { useStudentsContractList } from "@/tenant/features/students/hooks/useStudentsTsrHooks";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";

const SORT_FIELD_TO_API: Record<StudentsListContentSortField, string> = {
  name: "name",
  dob: "dob",
  status: "status",
  grNumber: "grNumber",
  gender: "gender",
  registeredDate: "registeredDate",
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

  const isWorkError =
    workPageQuery.isError || (workPageQuery.data != null && workPageQuery.data.status !== 200);

  // Return a modified query object that patches .data to be the body and incorporates status checking into .isError
  const workPageQueryPatched = {
    ...workPageQuery,
    isError: isWorkError,
    data: workPageQuery.data?.status === 200 ? workPageQuery.data.body : undefined,
  };

  return {
    workPageQuery: workPageQueryPatched,
    workStudents,
    shownCount,
  };
}
