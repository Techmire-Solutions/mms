import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();
const mockEligible = vi.fn();
const mockMutate = vi.fn();

vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettings: () => mockGetSettings(),
}));

vi.mock("../services/taskEligibleAssigneesService.js", () => ({
  getEligibleTaskAssignees: (...args: unknown[]) => mockEligible(...args),
}));

vi.mock("../services/taskMutationService.js", () => ({
  mutateTask: (...args: unknown[]) => mockMutate(...args),
  TaskDelegationError: class TaskDelegationError extends Error {},
}));

import { runTasksImportJob } from "../tasks/use-cases/taskImportUseCases.js";

const eligible = [
  {
    facultyId: "fac-1",
    name: "Zaid Khan",
    employeeId: "EMP-1",
    assignmentId: "asg-1",
    departmentName: null,
    userId: "user-1",
    isSelf: false,
  },
];

function context(viewerRole = "principal") {
  return {
    tenant: "demo",
    userId: "actor-1",
    viewerRole,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };
}

describe("runTasksImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({
      delegationScope: "descendants",
      allowSelfAssignment: true,
      notifyOnAssignment: true,
      notifyOnStatusChange: true,
    });
    mockEligible.mockResolvedValue(eligible);
    mockMutate.mockResolvedValue({ id: "created" });
  });

  it("imports valid rows, records bad ones, and defaults status/priority", async () => {
    const ctx = context();
    const result = await runTasksImportJob(
      [
        { title: "Prepare exams" },
        { description: "no title" },
        { title: "Call parents", assignee: "Zaid Khan", dueDate: "2026-11-10" },
      ],
      ctx,
    );

    expect(result).toMatchObject({ imported: 2, failed: 1, total: 3 });
    expect(result.errors).toEqual([{ row: 2, reason: "Title is required" }]);
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockMutate.mock.calls[0][3]).toMatchObject({
      kind: "create",
      data: { title: "Prepare exams", status: "todo", priority: "medium", assignees: [] },
    });
    expect(mockMutate.mock.calls[1][3].data).toMatchObject({
      title: "Call parents",
      assignees: [{ facultyId: "fac-1", userId: "user-1", facultyAssignmentId: "asg-1" }],
      dueAt: "2026-11-10T23:59:59.999Z",
    });
  });

  it("refuses an assignee when the importer lacks tasks.assign", async () => {
    const result = await runTasksImportJob(
      [{ title: "Call parents", assignee: "Zaid Khan" }],
      context("teacher"),
    );

    expect(result).toMatchObject({ imported: 0, failed: 1 });
    expect(result.errors[0]?.reason).toBe("Assignment permission required");
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
