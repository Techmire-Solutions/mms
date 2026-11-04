import { todayISO } from "@mms/shared";
import type { TaskQuickFilter } from "../hooks/useTasksWorkTabFilters";

export interface TaskServerFilters {
  search?: string;
  statuses?: string;
  priorities?: string;
  overdue?: boolean;
  dueOn?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface TaskServerFilterInput {
  quickFilter: TaskQuickFilter;
  search: string;
  statusFilter: readonly string[];
  priorityFilter: readonly string[];
  dueFrom?: string;
  dueTo?: string;
}

const OPEN_STATUSES = ["todo", "in_progress", "in_review", "blocked"] as const;

/**
 * Maps the client filter model onto the server query so pagination never
 * filters only the visible page (`GET /api/tasks` supports multi-status,
 * multi-priority, overdue and due-on filters).
 */
export function buildTaskServerFilters(input: TaskServerFilterInput): TaskServerFilters {
  const statuses =
    input.statusFilter.length > 0
      ? [...input.statusFilter]
      : input.quickFilter === "open"
        ? [...OPEN_STATUSES]
        : [];
  const priorities =
    input.priorityFilter.length > 0
      ? [...input.priorityFilter]
      : input.quickFilter === "urgent_high"
        ? ["high", "urgent"]
        : [];

  return {
    search: input.search.trim() || undefined,
    statuses: statuses.length > 0 ? statuses.join(",") : undefined,
    priorities: priorities.length > 0 ? priorities.join(",") : undefined,
    overdue: input.quickFilter === "overdue" || undefined,
    dueOn: input.quickFilter === "due_today" ? todayISO() : undefined,
    dueFrom: input.dueFrom || undefined,
    dueTo: input.dueTo || undefined,
  };
}
