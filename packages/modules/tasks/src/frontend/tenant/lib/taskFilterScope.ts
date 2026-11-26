export interface TaskFilterScopeInput {
  quickFilter: string;
  search: string;
  statusFilter: readonly string[];
  priorityFilter: readonly string[];
  dueFrom?: string;
  dueTo?: string;
  page?: number;
}

/**
 * Fingerprint of the visible task window. The bulk selection must be cleared
 * whenever this changes: a confirmed bulk archive must never hit rows that are
 * no longer on screen (`mms-module-architecture` §3 selection lifecycle).
 */
export function buildTaskFilterScopeKey(input: TaskFilterScopeInput): string {
  return [
    input.quickFilter,
    input.search.trim(),
    [...input.statusFilter].sort().join(","),
    [...input.priorityFilter].sort().join(","),
    input.dueFrom ?? "",
    input.dueTo ?? "",
    String(input.page ?? 0),
  ].join("|");
}
