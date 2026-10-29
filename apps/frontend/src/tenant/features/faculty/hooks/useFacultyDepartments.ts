import { type QueryClient, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import {
  facultyDepartmentSchema,
  type FacultyDepartmentEntity,
  type FacultyDepartmentWrite,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";
import { FACULTY_QUERY_KEY } from "./facultyQueryKeys";

export const FACULTY_DEPARTMENTS_QUERY_KEY = [...FACULTY_QUERY_KEY, "departments"] as const;

export function facultyDepartmentsQueryOptions(input: {
  includeDeleted?: boolean;
  loadFailed: string;
  invalidResponse: string;
}) {
  const includeDeleted = Boolean(input.includeDeleted);
  return queryOptions({
    queryKey: [...FACULTY_DEPARTMENTS_QUERY_KEY, { includeDeleted }] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.faculty.listDepartments({
        query: includeDeleted ? { includeDeleted: true } : undefined,
        fetchOptions: { signal },
      });
      if (response.status !== 200) throw new Error(input.loadFailed);
      const parsed = facultyDepartmentSchema
        .array()
        .safeParse((response.body as { departments?: unknown }).departments);
      if (!parsed.success) throw new Error(input.invalidResponse);
      return parsed.data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Server-authoritative list of faculty departments.
 * Falls back to an empty array on parse failure so the UI never hard-crashes.
 */
export function useFacultyDepartments(options: { includeDeleted?: boolean } = {}) {
  const { t } = useTranslation();
  return useQuery(
    facultyDepartmentsQueryOptions({
      includeDeleted: options.includeDeleted,
      loadFailed: t("faculty.errors.loadDepartments"),
      invalidResponse: t("faculty.errors.invalidDepartmentsResponse"),
    }),
  );
}

/** Saves a department (create or update) and invalidates the departments list. */
export function useSaveFacultyDepartment(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (input: FacultyDepartmentWrite & { id: string }) => {
        const response = await apiContract.faculty.saveDepartment({
          params: { id: input.id },
          body: input,
        });
        if (response.status !== 200) {
          const message =
            typeof response.body === "object" && response.body && "message" in response.body
              ? String(response.body.message)
              : t("faculty.errors.saveDepartment");
          throw new Error(message);
        }
        return facultyDepartmentSchema.parse(
          (response.body as { department?: unknown }).department,
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DEPARTMENTS_QUERY_KEY }),
    },
    client,
  );
}

/** Soft-deletes a department. Rejects (409) when active appointments reference it. */
export function useDeleteFacultyDepartment(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.deleteDepartment({
          params: { id },
          body: {},
        });
        if (response.status !== 200) {
          const message =
            typeof response.body === "object" && response.body && "message" in response.body
              ? String(response.body.message)
              : t("faculty.errors.deleteDepartment");
          throw new Error(message);
        }
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DEPARTMENTS_QUERY_KEY }),
    },
    client,
  );
}

/** Restores a soft-deleted department. */
export function useRestoreFacultyDepartment(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.restoreDepartment({
          params: { id },
          body: {},
        });
        if (response.status !== 200) {
          const message =
            typeof response.body === "object" && response.body && "message" in response.body
              ? String(response.body.message)
              : t("faculty.errors.restoreDepartment");
          throw new Error(message);
        }
        return facultyDepartmentSchema.parse(
          (response.body as { department?: unknown }).department,
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DEPARTMENTS_QUERY_KEY }),
    },
    client,
  );
}

/** Convenience: extract department names from entity list (for legacy dropdown compatibility). */
export function departmentEntitiesToNames(departments: FacultyDepartmentEntity[]): string[] {
  return departments.map((d) => d.name);
}
