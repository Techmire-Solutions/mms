import { describe, expect, it } from "vitest";
import { resolveTaskRecipients } from "../services/taskDelegationService.js";
import type { TaskRecipientRow } from "../db/repositories/taskRecipientRepository.js";

function recipient(overrides: Partial<TaskRecipientRow> = {}): TaskRecipientRow {
  return {
    facultyId: "staff",
    name: "Staff",
    employeeId: "E1",
    assignmentId: "assignment",
    departmentName: "IT",
    userId: "user",
    isSelf: false,
    ...overrides,
  };
}

describe("Task recipient authorization", () => {
  it.each([
    { facultyId: "other" },
    { facultyId: "staff", facultyAssignmentId: "forged" },
    { facultyId: "staff", userId: "forged" },
  ])("given a forged recipient tuple, should reject assignment when resolving %j", (input) => {
    const rows = [recipient()];
    const result = resolveTaskRecipients([input], rows);
    expect(result).toEqual({
      valid: false,
      resolvedAssignees: [],
      reason: "Recipient is not eligible for this assignment",
    });
  });

  it("given multiple appointments, should resolve the matching eligible appointment when selected", () => {
    const rows = [recipient(), recipient({ assignmentId: "second" })];
    const result = resolveTaskRecipients(
      [{ facultyId: "staff", facultyAssignmentId: "second" }],
      rows,
    );
    expect(result).toEqual({
      valid: true,
      resolvedAssignees: [{ facultyId: "staff", facultyAssignmentId: "second", userId: "user" }],
    });
  });

  it("given duplicate recipients, should return one recipient per login when resolving", () => {
    const input = { facultyId: "staff" };
    const result = resolveTaskRecipients([input, input], [recipient()]);
    expect(result.resolvedAssignees).toHaveLength(1);
  });

  it("given one ineligible recipient, should reject the whole batch when resolving", () => {
    const inputs = [{ facultyId: "staff" }, { facultyId: "ineligible" }];
    const result = resolveTaskRecipients(inputs, [recipient()]);
    expect(result.valid).toBe(false);
    expect(result.resolvedAssignees).toEqual([]);
  });

  it("given a self recipient row, should resolve when present in the eligible set", () => {
    const rows = [recipient({ facultyId: "me", userId: "me-user", isSelf: true })];
    const result = resolveTaskRecipients([{ facultyId: "me", userId: "me-user" }], rows);
    expect(result.valid).toBe(true);
    expect(result.resolvedAssignees).toEqual([
      {
        facultyId: "me",
        facultyAssignmentId: "assignment",
        userId: "me-user",
      },
    ]);
  });

  it("given text faculty ids, should accept non-uuid assignee inputs at the resolver boundary", () => {
    const rows = [recipient({ facultyId: "fac-legacy-1", userId: "user-legacy-1" })];
    const result = resolveTaskRecipients([{ facultyId: "fac-legacy-1" }], rows);
    expect(result.valid).toBe(true);
    expect(result.resolvedAssignees[0]?.facultyId).toBe("fac-legacy-1");
  });
});
