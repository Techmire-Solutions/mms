import { describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/shared";

const mockListTasks = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../db/repositories/tasksRepository.js", () => ({
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

    const result = await buildTasksCsvExport({}, { viewerRole: "admin" });

    expect(result.count).toBe(260);
    expect(result.csv.split("\n")).toHaveLength(261);
    expect(result.csv).toContain("Task 260");
    expect(mockListTasks).toHaveBeenCalledTimes(2);
    expect(mockListTasks.mock.calls[1][1]).toMatchObject({ offset: 250 });
  });

  it("streams the header once and every row", async () => {
    const all = Array.from({ length: 3 }, (_, i) => task(i + 1));
    mockListTasks.mockResolvedValue({ tasks: all, total: all.length });

    const generator = generateTasksCsvStreamChunks({}, { viewerRole: "admin" });
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
