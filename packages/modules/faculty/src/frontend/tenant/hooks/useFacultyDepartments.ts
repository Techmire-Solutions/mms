import { type QueryClient, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import {
  facultyDepartmentSchema,
  type FacultyDepartmentEntity,
  type FacultyDepartmentWrite,
} from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { useTranslation } from "@mms/fe-core/i18n";
import { useQueryClientOrFallback } from "@mms/fe-core/query/optionalQueryContext";
import { FACULTY_QUERY_KEY } from "./facultyQueryKeys";
import { assertContractOk } from "@mms/fe-core/api/contractError";

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
      assertContractOk(response, input.loadFailed);
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
 * A failed read surfaces as a query error; consumers fall back to `[]` via `?? []`.
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
        assertContractOk(response, t("faculty.errors.saveDepartment"));
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
        assertContractOk(response, t("faculty.errors.deleteDepartment"));
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
        assertContractOk(response, t("faculty.errors.restoreDepartment"));
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
