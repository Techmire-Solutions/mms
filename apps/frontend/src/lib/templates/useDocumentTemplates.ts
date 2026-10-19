import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { DocumentTemplate } from "@mms/shared";
import {
  deleteDocumentTemplateServer,
  fetchDocumentTemplateServer,
  saveDocumentTemplateServer,
} from "./documentTemplatesApi";

export const DOCUMENT_TEMPLATES_QUERY_KEY_ROOT = ["document_templates"] as const;

export function documentTemplateQueryKey(key: string) {
  return [...DOCUMENT_TEMPLATES_QUERY_KEY_ROOT, key] as const;
}

/** Invalidate cached templates (optionally scoped to a specific key). */
export function invalidateDocumentTemplatesQueries(queryClient: QueryClient, key?: string): void {
  if (key) {
    void queryClient.invalidateQueries({ queryKey: documentTemplateQueryKey(key) });
  } else {
    void queryClient.invalidateQueries({ queryKey: DOCUMENT_TEMPLATES_QUERY_KEY_ROOT });
  }
}

/** Standard queryOptions for reading a document template layout. */
export function documentTemplateQueryOptions<TPayload>(
  key: string,
  fallback: DocumentTemplate<TPayload>,
) {
  return queryOptions({
    queryKey: documentTemplateQueryKey(key),
    queryFn: async (): Promise<DocumentTemplate<TPayload>> => {
      const serverTemplate = await fetchDocumentTemplateServer<TPayload>(key);
      return serverTemplate ?? fallback;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Hook to fetch a document template with fallback fallback layout. */
export function useDocumentTemplateQuery<TPayload>(
  key: string,
  fallback: DocumentTemplate<TPayload>,
): UseQueryResult<DocumentTemplate<TPayload>> {
  return useQuery(documentTemplateQueryOptions<TPayload>(key, fallback));
}

/** Hook to save/update a document template with automatic query cache invalidation. */
export function useDocumentTemplateMutation<TPayload>(
  key: string,
): UseMutationResult<DocumentTemplate<TPayload>, Error, DocumentTemplate<TPayload>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: DocumentTemplate<TPayload>) => {
      return await saveDocumentTemplateServer<TPayload>(key, template);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(documentTemplateQueryKey(key), saved);
      invalidateDocumentTemplatesQueries(queryClient, key);
    },
  });
}

/** Hook to delete a custom document template and revert to defaults. */
export function useDocumentTemplateDeleteMutation(
  key: string,
): UseMutationResult<boolean, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await deleteDocumentTemplateServer(key);
    },
    onSuccess: () => {
      invalidateDocumentTemplatesQueries(queryClient, key);
    },
  });
}
