import { type QueryClient, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { facultyDesignationSchema, type FacultyDesignationWrite } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useQueryClientOrFallback } from "@/lib/query/optionalQueryContext";
import { FACULTY_QUERY_KEY } from "./facultyQueryKeys";
import { assertContractOk } from "@/lib/apiContractError";

export const FACULTY_DESIGNATIONS_QUERY_KEY = [...FACULTY_QUERY_KEY, "designations"] as const;

export function facultyDesignationsQueryOptions(input: {
  includeDeleted?: boolean;
  loadFailed: string;
  invalidResponse: string;
}) {
  const includeDeleted = Boolean(input.includeDeleted);
  return queryOptions({
    queryKey: [...FACULTY_DESIGNATIONS_QUERY_KEY, { includeDeleted }] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.faculty.listDesignations({
        query: includeDeleted ? { includeDeleted: true } : undefined,
        fetchOptions: { signal },
      });
      assertContractOk(response, input.loadFailed);
      const parsed = facultyDesignationSchema
        .array()
        .safeParse((response.body as { designations?: unknown }).designations);
      if (!parsed.success) throw new Error(input.invalidResponse);
      return parsed.data;
    },
    staleTime: 30_000,
  });
}

/** Server-authoritative dynamic designation definitions. */
export function useFacultyDesignations(options: { includeDeleted?: boolean } = {}) {
  const { t } = useTranslation();
  return useQuery(
    facultyDesignationsQueryOptions({
      includeDeleted: options.includeDeleted,
      loadFailed: t("faculty.errors.loadDesignations"),
      invalidResponse: t("faculty.errors.invalidDesignationsResponse"),
    }),
  );
}

/** Saves a designation definition and refreshes every designation projection. */
export function useSaveFacultyDesignation(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (input: FacultyDesignationWrite) => {
        const response = await apiContract.faculty.saveDesignation({
          params: { id: input.id },
          body: input,
        });
        assertContractOk(response, t("faculty.errors.saveDesignation"));
        return facultyDesignationSchema.parse(
          (response.body as { designation?: unknown }).designation,
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DESIGNATIONS_QUERY_KEY }),
    },
    client,
  );
}

/** Soft-deletes a designation definition. Rejects (409) when active appointments reference it. */
export function useDeleteFacultyDesignation(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.deleteDesignation({
          params: { id },
          body: {},
        });
        assertContractOk(response, t("faculty.errors.deleteDesignation"));
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DESIGNATIONS_QUERY_KEY }),
    },
    client,
  );
}

/** Restores a soft-deleted designation definition. */
export function useRestoreFacultyDesignation(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useQueryClientOrFallback();
  const client = customClient ?? contextClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.restoreDesignation({
          params: { id },
          body: {},
        });
        assertContractOk(response, t("faculty.errors.restoreDesignation"));
        return facultyDesignationSchema.parse(
          (response.body as { designation?: unknown }).designation,
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DESIGNATIONS_QUERY_KEY }),
    },
    client,
  );
}
