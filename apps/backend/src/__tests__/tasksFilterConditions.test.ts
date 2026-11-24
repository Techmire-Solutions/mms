import { describe, expect, it } from "vitest";
import type { TaskListQuery } from "@mms/contracts";
import { buildTaskFilterConditions } from "../db/repositories/tasksFilterConditions.js";

describe("buildTaskFilterConditions", () => {
  const timezone = "Asia/Karachi";
  const baseQuery: TaskListQuery = {
    limit: 10,
    offset: 0,
    includeDeleted: false,
    overdue: false,
  };

  it("returns empty array for undefined or empty query", () => {
    expect(buildTaskFilterConditions(undefined, timezone)).toEqual([]);
    expect(buildTaskFilterConditions(baseQuery, timezone)).toEqual([]);
  });

  it("handles status, priority, and createdById filters", () => {
    const conditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        status: "in_progress",
        priority: "urgent",
        createdById: "user-123",
      },
      timezone,
    );
    expect(conditions.length).toBe(3);
  });

  it("handles date-only and timestamp dueFrom and dueTo filters", () => {
    const isoConditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        dueFrom: "2026-11-20T10:00:00.000Z",
        dueTo: "2026-11-25T18:00:00.000Z",
      },
      timezone,
    );
    expect(isoConditions.length).toBe(2);

    const dateOnlyConditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        dueFrom: "2026-11-20",
        dueTo: "2026-11-25",
      },
      timezone,
    );
    expect(dateOnlyConditions.length).toBe(2);
  });

  it("splits and filters valid enum values for statuses and priorities", () => {
    const conditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        statuses: "pending, in_progress, invalid_status",
        priorities: "low, urgent, fake_priority",
      },
      timezone,
    );
    expect(conditions.length).toBe(2);
  });

  it("handles ids list and overdue filter", () => {
    const conditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        ids: "task-1, task-2, task-3",
        overdue: true,
      },
      timezone,
    );
    expect(conditions.length).toBe(2);
  });

  it("handles dueOn single workspace day filter", () => {
    const conditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        dueOn: "2026-11-20",
      },
      timezone,
    );
    expect(conditions.length).toBe(1);
  });

  it("handles text search with SQL pattern conversion", () => {
    const conditions = buildTaskFilterConditions(
      {
        ...baseQuery,
        search: "examination report",
      },
      timezone,
    );
    expect(conditions.length).toBe(1);
  });
});
