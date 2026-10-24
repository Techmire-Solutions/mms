import { useContext } from "react";
import {
  QueryClient,
  QueryClientContext,
  queryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { facultyDesignationSchema, type FacultyDesignationWrite } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { FACULTY_QUERY_KEY } from "./facultyQueryKeys";

export const FACULTY_DESIGNATIONS_QUERY_KEY = [...FACULTY_QUERY_KEY, "designations"] as const;

const fallbackQueryClient = new QueryClient();

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
      if (response.status !== 200) throw new Error(input.loadFailed);
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
  const contextClient = useContext(QueryClientContext);
  const client = customClient ?? contextClient ?? fallbackQueryClient;
  return useMutation(
    {
      mutationFn: async (input: FacultyDesignationWrite) => {
        const response = await apiContract.faculty.saveDesignation({
          params: { id: input.id },
          body: input,
        });
        if (response.status !== 200) throw new Error(t("faculty.errors.saveDesignation"));
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
  const contextClient = useContext(QueryClientContext);
  const client = customClient ?? contextClient ?? fallbackQueryClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.deleteDesignation({
          params: { id },
          body: {},
        });
        if (response.status !== 200) {
          const message =
            typeof response.body === "object" && response.body && "message" in response.body
              ? String(response.body.message)
              : t("faculty.errors.deleteDesignation");
          throw new Error(message);
        }
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DESIGNATIONS_QUERY_KEY }),
    },
    client,
  );
}

/** Restores a soft-deleted designation definition. */
export function useRestoreFacultyDesignation(customClient?: QueryClient) {
  const { t } = useTranslation();
  const contextClient = useContext(QueryClientContext);
  const client = customClient ?? contextClient ?? fallbackQueryClient;
  return useMutation(
    {
      mutationFn: async (id: string) => {
        const response = await apiContract.faculty.restoreDesignation({
          params: { id },
          body: {},
        });
        if (response.status !== 200) {
          const message =
            typeof response.body === "object" && response.body && "message" in response.body
              ? String(response.body.message)
              : t("faculty.errors.restoreDesignation");
          throw new Error(message);
        }
        return facultyDesignationSchema.parse(
          (response.body as { designation?: unknown }).designation,
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey: FACULTY_DESIGNATIONS_QUERY_KEY }),
    },
    client,
  );
}
