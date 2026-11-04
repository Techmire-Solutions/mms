import { describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/shared";

const mockListTasks = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../tasks/use-cases/tasksUseCases.js", () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

import {
  buildTasksCsvExport,
  generateTasksCsvStreamChunks,
} from "../services/tasksExportService.js";

function task(index: number): TaskRecord {
  return {
    id: `task-${index}`,
    workspaceSubdomain: "demo",
    title: `Task ${index}`,
    description: null,
    priority: "medium",
    status: "todo",
    startDate: null,
    dueAt: null,
    parentTaskId: null,
    assignees: [],
  };
}

describe("tasks export", () => {
  it("walks every page instead of truncating at the first one", async () => {
    const all = Array.from({ length: 260 }, (_, i) => task(i + 1));
    mockListTasks.mockImplementation((_tenant: string, query: { offset: number; limit: number }) =>
      Promise.resolve({
        tasks: all.slice(query.offset, query.offset + query.limit),
        total: all.length,
      }),
    );

    const result = await buildTasksCsvExport({}, {});

    expect(result.count).toBe(260);
    expect(result.csv.split("\n")).toHaveLength(261);
    expect(result.csv).toContain("Task 260");
    expect(mockListTasks).toHaveBeenCalledTimes(2);
    expect(mockListTasks.mock.calls[1][1]).toMatchObject({ offset: 250 });
  });

  it("forwards every directory filter and the selected ids into the page query", async () => {
    mockListTasks.mockResolvedValue({ tasks: [], total: 0 });

    await buildTasksCsvExport(
      {
        statuses: "todo,blocked",
        priorities: "high,urgent",
        overdue: true,
        dueOn: "2026-11-04",
        dueFrom: "2026-11-04T00:00:00.000Z",
        dueTo: "2026-11-04T23:59:59.999Z",
        includeIds: ["task-1", "task-2"],
        includeDeleted: true,
      },
      { allowDeleted: true },
    );

    expect(mockListTasks.mock.calls[0]?.[1]).toMatchObject({
      statuses: "todo,blocked",
      priorities: "high,urgent",
      overdue: true,
      dueOn: "2026-11-04",
      dueFrom: "2026-11-04T00:00:00.000Z",
      dueTo: "2026-11-04T23:59:59.999Z",
      ids: "task-1,task-2",
      includeDeleted: true,
    });
  });

  it("streams the header once and every row", async () => {
    const all = Array.from({ length: 3 }, (_, i) => task(i + 1));
    mockListTasks.mockResolvedValue({ tasks: all, total: all.length });

    const generator = generateTasksCsvStreamChunks({}, {});
    const chunks: string[] = [];
    let next = await generator.next();
    while (!next.done) {
      chunks.push(next.value);
      next = await generator.next();
    }

    expect(next.value.count).toBe(3);
    expect(chunks.join("").match(/Task Title/g)).toHaveLength(1);
    expect(chunks.join("")).toContain("Task 3");
  });
});
