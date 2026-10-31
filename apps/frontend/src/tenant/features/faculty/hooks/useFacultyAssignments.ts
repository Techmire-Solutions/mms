import { type QueryClient, useQuery } from "@tanstack/react-query";
import type { FacultyAssignmentEntity } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";
import { FACULTY_QUERY_KEY } from "./facultyQueryKeys";

export function useFacultyAssignments(facultyId?: string | null, customClient?: QueryClient) {
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;

  return useQuery(
    {
      queryKey: [...FACULTY_QUERY_KEY, "assignments", facultyId] as const,
      queryFn: async ({ signal }) => {
        if (!facultyId) return [];
        const response = await apiContract.faculty.listAssignments({
          params: { facultyId },
          fetchOptions: { signal },
        });
        if (response.status !== 200) return [];
        return (response.body as { assignments?: FacultyAssignmentEntity[] }).assignments ?? [];
      },
      enabled: Boolean(facultyId),
      staleTime: 30_000,
    },
    client,
  );
}
