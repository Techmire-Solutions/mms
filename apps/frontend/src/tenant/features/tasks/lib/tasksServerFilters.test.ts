import { describe, expect, it } from "vitest";
import { buildTaskServerFilters } from "./tasksServerFilters";

const base = {
  quickFilter: "all" as const,
  search: "",
  statusFilter: [] as string[],
  priorityFilter: [] as string[],
};

describe("buildTaskServerFilters", () => {
  it("maps multi-selects to comma-separated server params", () => {
    const filters = buildTaskServerFilters({
      ...base,
      statusFilter: ["todo", "blocked"],
      priorityFilter: ["high", "urgent"],
      dueFrom: "2026-10-01",
      dueTo: "2026-10-31",
    });

    expect(filters).toEqual({
      search: undefined,
      statuses: "todo,blocked",
      priorities: "high,urgent",
      overdue: undefined,
      dueOn: undefined,
      dueFrom: "2026-10-01",
      dueTo: "2026-10-31",
    });
  });

  it("maps the open quick filter to the four open statuses", () => {
    const filters = buildTaskServerFilters({ ...base, quickFilter: "open" });

    expect(filters.statuses).toBe("todo,in_progress,in_review,blocked");
    expect(filters.overdue).toBeUndefined();
  });

  it("maps overdue and due-today quick filters", () => {
    expect(buildTaskServerFilters({ ...base, quickFilter: "overdue" }).overdue).toBe(true);
    expect(buildTaskServerFilters({ ...base, quickFilter: "due_today" }).dueOn).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("sends the search term trimmed and ignores blank input", () => {
    expect(buildTaskServerFilters({ ...base, search: "  exam  " }).search).toBe("exam");
    expect(buildTaskServerFilters({ ...base, search: "   " }).search).toBeUndefined();
  });
});
