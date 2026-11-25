import type { QueryClient } from "@tanstack/react-query";

let invalidator: ((queryClient: QueryClient) => void) | null = null;

export function configureFacultyUsersInvalidator(fn: (queryClient: QueryClient) => void): void {
  invalidator = fn;
}

export function invalidateUsersQueries(queryClient: QueryClient): void {
  invalidator?.(queryClient);
}
