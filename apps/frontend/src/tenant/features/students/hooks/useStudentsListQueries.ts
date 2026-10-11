import { STUDENTS_MODULE_MANIFEST, type Student, type StudentsListQuery } from "@mms/shared";
import { apiContract, tsrClient } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  STUDENTS_QUERY_KEY,
  type StudentRecord,
  type StudentsListPageResult,
  type StudentsPaginatedParams,
} from "@/tenant/features/students/hooks/studentsQueryKeys";

/** Fetches all pages matching Work filters for export (server-paged walk). */
export async function fetchAllStudentsForQuery(
  params: Omit<StudentsPaginatedParams, "page" | "enabled">,
  onProgress?: (fetched: number, total: number) => void,
): Promise<StudentRecord[]> {
  const limit = STUDENTS_MODULE_MANIFEST.maxPageSize;
  const all: StudentRecord[] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const listQuery: StudentsListQuery & { page: number; limit: number } = {
      ...params,
      page,
      limit,
    };
    const response = await apiContract.students.list({ query: listQuery });
    const studentsPage = response.body as StudentsListPageResult;
    all.push(...(studentsPage.students as StudentRecord[]));
    total = studentsPage.total;
    onProgress?.(all.length, total);
    if (!studentsPage.hasMore) break;
    if (page >= 200) {
      throw new Error(
        "Student export exceeds the 100,000-record safety limit; narrow the filters.",
      );
    }
    page += 1;
  }

  return all;
}
import { useAuth } from "@/lib/contexts/AuthContext";
import { uniqueRegistryIds } from "@/lib/registryResolve";

export function useStudentLinkedContactIds(excludeId?: string, enabled = true) {
  const { isAuthenticated } = useAuth();

  const query = tsrClient.students.linkedContactIds.useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, "linked-contact-ids", excludeId ?? ""] as const,
    queryData: { query: { excludeId } },
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });

  return {
    ...query,
    data: (query.data?.body as { contactIds?: Array<string | number> } | null)?.contactIds,
  };
}

export function useStudentsByIds(ids: (string | number | null | undefined)[]) {
  const { isAuthenticated } = useAuth();
  const normalized = (() => uniqueRegistryIds(ids))();

  const query = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, "resolve", normalized.join(",")] as const,
    queryFn: async () => {
      const res = await apiContract.students.resolve({ body: { ids: normalized } });
      return (res.body as { students?: Student[] } | null)?.students;
    },
    enabled: isAuthenticated && normalized.length > 0,
    staleTime: 30_000,
  });

  return { ...query, data: query.data };
}

export type { StudentsPaginatedParams };
