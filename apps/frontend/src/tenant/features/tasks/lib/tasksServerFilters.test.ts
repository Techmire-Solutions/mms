import { describe, expect, it, vi, afterEach } from "vitest";
import { buildTaskServerFilters, resolveLocalDayBounds } from "./tasksServerFilters";

const base = {
  quickFilter: "all" as const,
  search: "",
  statusFilter: [] as string[],
  priorityFilter: [] as string[],
};

describe("buildTaskServerFilters", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps multi-selects to comma-separated server params", () => {
    const dueFrom = new Date(2026, 9, 1, 0, 0, 0, 0).toISOString();
    const dueTo = new Date(2026, 9, 31, 23, 59, 59, 999).toISOString();
    const filters = buildTaskServerFilters({
      ...base,
      statusFilter: ["todo", "blocked"],
      priorityFilter: ["high", "urgent"],
      dueFrom,
      dueTo,
    });

    expect(filters).toEqual({
      search: undefined,
      statuses: "todo,blocked",
      priorities: "high,urgent",
      overdue: undefined,
      dueFrom,
      dueTo,
    });
    expect(filters).not.toHaveProperty("dueOn");
  });

  it("maps the open quick filter to the four open statuses", () => {
    const filters = buildTaskServerFilters({ ...base, quickFilter: "open" });

    expect(filters.statuses).toBe("todo,in_progress,in_review,blocked");
    expect(filters.overdue).toBeUndefined();
  });

  it("sends due-today as an explicit local-day instant range, never a UTC date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0, 0));

    const filters = buildTaskServerFilters({ ...base, quickFilter: "due_today" });

    expect(filters.dueFrom).toBe(new Date(2026, 10, 4, 0, 0, 0, 0).toISOString());
    expect(filters.dueTo).toBe(new Date(2026, 10, 4, 23, 59, 59, 999).toISOString());
    expect(filters).not.toHaveProperty("dueOn");
  });

  it("maps My Tasks to open work assigned to the caller", () => {
    const filters = buildTaskServerFilters({
      ...base,
      quickFilter: "mine",
      currentUserId: "user-42",
    });
    expect(filters.assignedToUserId).toBe("user-42");
    expect(filters.statuses).toBe("todo,in_progress,in_review,blocked");
  });

  it("maps the overdue quick filter", () => {
    expect(buildTaskServerFilters({ ...base, quickFilter: "overdue" }).overdue).toBe(true);
  });

  it("sends the search term trimmed and ignores blank input", () => {
    expect(buildTaskServerFilters({ ...base, search: "  exam  " }).search).toBe("exam");
    expect(buildTaskServerFilters({ ...base, search: "   " }).search).toBeUndefined();
  });
});

describe("resolveLocalDayBounds", () => {
  it("covers exactly the local calendar day of the supplied instant", () => {
    const bounds = resolveLocalDayBounds(new Date(2026, 10, 4, 12, 34, 56));
    const from = new Date(bounds.from);
    const to = new Date(bounds.to);

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(10);
    expect(from.getDate()).toBe(4);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getDate()).toBe(4);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });
});
