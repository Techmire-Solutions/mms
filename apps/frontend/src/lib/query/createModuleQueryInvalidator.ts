import type { QueryClient } from "@tanstack/react-query";

export interface ModuleQueryInvalidatorKeys {
  /** The module's primary list key. */
  list: readonly unknown[];
  /**
   * Additional list-shaped keys the module owns (e.g. finance invoices *and*
   * payments, hasanat six collections). Invalidated alongside `list`.
   */
  lists?: readonly (readonly unknown[])[];
  /** Optional — omit when the module has no separate count key (avoids a duplicate invalidate). */
  count?: readonly unknown[];
  metrics: readonly unknown[];
  /** Omit when the module has no widget-aggregate cache. */
  widgetAggregates?: readonly unknown[];
  /** Setup tier. Omitting it left 18 modules with stale setup screens after a mutation. */
  preferences?: readonly unknown[];
  lookups?: readonly unknown[];
}

/**
 * Shared module Query invalidation for Work mutations + live push.
 * Module adapters (Teachers/Students) pass their typed Query keys once.
 */
export function createModuleQueryInvalidator(keys: ModuleQueryInvalidatorKeys) {
  return function invalidateModuleQueries(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ queryKey: keys.list });
    for (const listKey of keys.lists ?? []) {
      void queryClient.invalidateQueries({ queryKey: listKey });
    }
    if (keys.count) void queryClient.invalidateQueries({ queryKey: keys.count });
    void queryClient.invalidateQueries({ queryKey: keys.metrics });
    if (keys.widgetAggregates) {
      void queryClient.invalidateQueries({ queryKey: keys.widgetAggregates });
    }
    if (keys.preferences) void queryClient.invalidateQueries({ queryKey: keys.preferences });
    if (keys.lookups) void queryClient.invalidateQueries({ queryKey: keys.lookups });
  };
}
