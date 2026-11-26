import { describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "@mms/contracts";

const mockListTasks = vi.fn();
const mockGetWorkspaceTimezone = vi.fn().mockReturnValue("UTC");

vi.mock("@mms/be-core/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/http")>()),
  getRequestTenant: () => "demo",
}));
vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../use-cases/tasksUseCases.js", () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

vi.mock("../services/taskSettingsService.js", () => ({
  getWorkspaceTimezone: (...args: unknown[]) => mockGetWorkspaceTimezone(...args),
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

  it("renders due dates in the workspace timezone (m5)", async () => {
    mockGetWorkspaceTimezone.mockReturnValue("Asia/Karachi");
    mockListTasks.mockResolvedValue({
      tasks: [
        { ...task(1), dueAt: "2026-09-30T20:00:00.000Z" }, // 2026-10-01 01:00 in Karachi
      ],
      total: 1,
    });

    const result = await buildTasksCsvExport({}, {});

    expect(result.csv).toContain("2026-10-01");
    expect(result.csv).not.toContain("2026-09-30");
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
