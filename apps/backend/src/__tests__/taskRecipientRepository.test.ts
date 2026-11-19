import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const execute = vi.fn<() => unknown>(() => ({ rows: [] }));
  return {
    execute,
  };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, fn: (tx: { execute: typeof mocks.execute }) => Promise<unknown>) =>
    fn({ execute: mocks.execute }),
}));

import { findEligibleTaskRecipientRows } from "../db/repositories/taskRecipientRepository.js";

describe("taskRecipientRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries eligible task recipient rows with default options", async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          facultyId: "fac-1",
          name: "Teacher One",
          employeeId: "EMP-001",
          assignmentId: "asgn-1",
          departmentName: "Islamic Studies",
          userId: "usr-1",
          userEmail: "teacher1@example.com",
          isSelf: true,
        },
      ],
    });

    const rows = await findEligibleTaskRecipientRows("test-tenant", "usr-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].facultyId).toBe("fac-1");
    expect(rows[0].name).toBe("Teacher One");
    expect(rows[0].isSelf).toBe(true);
  });

  it("passes facultyIds filter when specified", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });

    const rows = await findEligibleTaskRecipientRows(
      "test-tenant",
      "usr-1",
      { canAssignAnywhere: true },
      ["fac-1", "fac-2"],
    );
    expect(rows).toEqual([]);
    expect(mocks.execute).toHaveBeenCalled();
  });
});
