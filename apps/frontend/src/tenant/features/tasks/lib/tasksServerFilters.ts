import type { TaskQuickFilter } from "../hooks/useTasksWorkTabFilters";

export interface TaskServerFilters {
  search?: string;
  statuses?: string;
  priorities?: string;
  overdue?: boolean;
  assignedToUserId?: string;
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
  currentUserId?: string;
}

const OPEN_STATUSES = ["todo", "in_progress", "in_review", "blocked"] as const;

/**
 * Serialises the local calendar day as an explicit UTC instant range. The API
 * treats a bare `YYYY-MM-DD` as a UTC day, which shifts "today" for every
 * non-UTC workspace; an ISO instant is unambiguous.
 */
export function resolveLocalDayBounds(now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** A date-only filter is a local calendar day; the API would read it as a UTC day. */
function toLocalDayStart(value: string): string {
  if (value.includes("T")) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toLocalDayEnd(value: string): string {
  if (value.includes("T")) return value;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/**
 * Maps the client filter model onto the server query so pagination never
 * filters only the visible page (`GET /api/tasks` supports multi-status,
 * multi-priority, overdue and due-on filters).
 */
export function buildTaskServerFilters(input: TaskServerFilterInput): TaskServerFilters {
  const mine = input.quickFilter === "mine" && Boolean(input.currentUserId);
  const statuses =
    input.statusFilter.length > 0
      ? [...input.statusFilter]
      : input.quickFilter === "open" || mine
        ? [...OPEN_STATUSES]
        : [];
  const priorities =
    input.priorityFilter.length > 0
      ? [...input.priorityFilter]
      : input.quickFilter === "urgent_high"
        ? ["high", "urgent"]
        : [];

  const today = input.quickFilter === "due_today" ? resolveLocalDayBounds() : undefined;

  return {
    search: input.search.trim() || undefined,
    statuses: statuses.length > 0 ? statuses.join(",") : undefined,
    priorities: priorities.length > 0 ? priorities.join(",") : undefined,
    overdue: input.quickFilter === "overdue" || undefined,
    assignedToUserId: mine ? input.currentUserId : undefined,
    dueFrom: today?.from ?? (input.dueFrom ? toLocalDayStart(input.dueFrom) : undefined),
    dueTo: today?.to ?? (input.dueTo ? toLocalDayEnd(input.dueTo) : undefined),
  };
}
