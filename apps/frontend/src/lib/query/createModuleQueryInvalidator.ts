import type { QueryClient } from "@tanstack/react-query";

export interface ModuleQueryInvalidatorKeys {
  list: readonly unknown[];
  /** Optional — omit when the module has no separate count key (avoids a duplicate invalidate). */
  count?: readonly unknown[];
  metrics: readonly unknown[];
  widgetAggregates: readonly unknown[];
  preferences: readonly unknown[];
  lookups: readonly unknown[];
}

/**
 * Shared module Query invalidation for Work mutations + live push.
 * Module adapters (Teachers/Students) pass their typed Query keys once.
 */
export function createModuleQueryInvalidator(keys: ModuleQueryInvalidatorKeys) {
  return function invalidateModuleQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: keys.list });
    if (keys.count) void queryClient.invalidateQueries({ queryKey: keys.count });
    void queryClient.invalidateQueries({ queryKey: keys.metrics });
    void queryClient.invalidateQueries({ queryKey: keys.widgetAggregates });
    void queryClient.invalidateQueries({ queryKey: keys.preferences });
    void queryClient.invalidateQueries({ queryKey: keys.lookups });
  };
}
