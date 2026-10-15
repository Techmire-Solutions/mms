import { queryOptions, mutationOptions, QueryClient } from "@tanstack/react-query";

export interface TemplateEntity {
  id: string;
  name: string;
  status: string;
}

/** Structured tuple keys for cache scoping. */
export const templateKeys = {
  all: ["tenant", "templateEntities"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: (params: Record<string, string | number>) => [...templateKeys.lists(), params] as const,
  details: () => [...templateKeys.all, "detail"] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

/** Detail query options with automatic AbortSignal forwarding. */
export function templateDetailQueryOptions(
  id: string,
  fetchFn: (id: string, signal: AbortSignal) => Promise<TemplateEntity>,
) {
  return queryOptions({
    queryKey: templateKeys.detail(id),
    queryFn: ({ signal }) => fetchFn(id, signal),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

/** Optimistic update mutation options with rollback on error. */
export function templateUpdateMutationOptions(
  queryClient: QueryClient,
  updateFn: (entity: TemplateEntity) => Promise<TemplateEntity>,
) {
  return mutationOptions({
    mutationFn: updateFn,
    onMutate: async (updatedEntity: TemplateEntity) => {
      // 1. Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: templateKeys.detail(updatedEntity.id) });

      // 2. Snapshot previous value
      const previous = queryClient.getQueryData<TemplateEntity>(
        templateKeys.detail(updatedEntity.id),
      );

      // 3. Optimistically update cache
      queryClient.setQueryData(templateKeys.detail(updatedEntity.id), updatedEntity);

      return { previous };
    },
    onError: (_err, updatedEntity, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(templateKeys.detail(updatedEntity.id), context.previous);
      }
    },
    onSettled: (_data, _err, updatedEntity) => {
      // Invalidate on completion
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(updatedEntity.id) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}
