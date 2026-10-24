# TanStack Query Factories, Key Hierarchies & Cache Policies

This guide defines the standards for authoring TanStack Query v5 query and mutation factories in MMS, managing tuple keys, forwarding abort signals, and executing optimistic rollbacks.

---

## 1. Tuple Query Key Hierarchy

Query keys must be read-only tuple arrays conforming to a structured hierarchy:
`[scope, resource, actionOrId, params?] as const`

### Examples

```ts
export const STUDENT_KEYS = {
  all: ["tenant", "students"] as const,
  lists: () => [...STUDENT_KEYS.all, "list"] as const,
  list: (params: StudentListParams) => [...STUDENT_KEYS.lists(), params] as const,
  details: () => [...STUDENT_KEYS.all, "detail"] as const,
  detail: (id: string) => [...STUDENT_KEYS.details(), id] as const,
  metrics: () => [...STUDENT_KEYS.all, "metrics"] as const,
};
```

---

## 2. Standard `queryOptions` Factory

Always forward `{ signal }` from `queryFn` to cancel requests on unmount or query invalidation:

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/apiClient";

export function studentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: STUDENT_KEYS.detail(id),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<StudentRecord>(`/api/students/${id}`, {
        signal,
      });
      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

## 3. Optimistic Mutation Pattern

For instant UI feedback, cancel outgoing refetches, snapshot previous state, optimistically update the cache, and restore on failure:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/apiClient";
import { notify } from "@/components/ui/notify";

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateStudentInput) => {
      const res = await apiClient.put(`/api/students/${payload.id}`, payload);
      return res.data;
    },
    onMutate: async (newStudent) => {
      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: STUDENT_KEYS.detail(newStudent.id) });

      // 2. Snapshot previous value
      const previousStudent = queryClient.getQueryData(STUDENT_KEYS.detail(newStudent.id));

      // 3. Optimistically update cache
      queryClient.setQueryData(STUDENT_KEYS.detail(newStudent.id), (old: any) => ({
        ...old,
        ...newStudent,
      }));

      return { previousStudent };
    },
    onError: (err, newStudent, context) => {
      // Rollback to previous state
      if (context?.previousStudent) {
        queryClient.setQueryData(STUDENT_KEYS.detail(newStudent.id), context.previousStudent);
      }
      notify.error("Failed to update student");
    },
    onSettled: (data, error, variables) => {
      // Always invalidate cache after completion
      queryClient.invalidateQueries({ queryKey: STUDENT_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: STUDENT_KEYS.lists() });
    },
  });
}
```

---

## 4. Collection Public Facade Organization

All collection query hooks must be exposed via `@/tenant/hooks/collections/<module>.ts`.
- Direct imports from `@/tenant/features/<module>/hooks/*` from outside the feature are forbidden.
- Cross-feature consumers import directly from the collection facade.
