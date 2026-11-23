import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Executes the contact-op SQL probes against a chainable fake Drizzle tx.
 * Guards the re-registration restore path: the soft-deleted lookup MUST project
 * the employment-owned contact/employee fields, otherwise the restored faculty
 * loses `contact_id` and trips `faculty_employments_contact_fk` on re-create.
 */
const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));

vi.mock("../db/tenant-context.js", () => {
  const makeTx = () => {
    const nextRows = () => queue.rows.shift() ?? [];
    const query = {
      limit: async () => nextRows(),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(nextRows()).then(resolve, reject),
    };
    return {
      select: () => ({ from: () => ({ innerJoin: () => ({ where: () => query }) }) }),
    };
  };
  return { withTenantRead: (_tenant: string, fn: (tx: unknown) => unknown) => fn(makeTx()) };
});

import {
  findFacultyRegistrationConflictSql,
  findSoftDeletedFacultyByContactIdSql,
  listFacultyLinkedContactIdsSql,
} from "../db/repositories/facultyRepositoryListContactOps.js";

function facultyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fac-deadbeef",
    workspaceSubdomain: "mis",
    employmentId: "facemp-deadbeef",
    userId: null,
    profileStatus: "active",
    specialization: "Tajweed",
    qualification: "M.A.",
    performanceRating: null,
    notes: null,
    customData: null,
    deletedAt: new Date("2026-11-23T07:06:24.801Z"),
    deletedBy: "user-1",
    deletionReason: "duplicate",
    restoredAt: null,
    restoredBy: null,
    deletedWithCascade: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    createdBy: "user-1",
    updatedBy: "user-1",
    // Employment-owned fields the restore probe must project.
    contactId: "01a1e3ef-e2ac-7ab6-a4f5-a89fd51e2595",
    employeeId: "FAC-26-0001",
    status: "active",
    employmentStartDate: "2024-10-01",
    employmentEndDate: null,
    ...overrides,
  };
}

describe("facultyRepositoryListContactOps", () => {
  beforeEach(() => {
    queue.rows = [];
  });

  it("projects the employment contact/employee fields when probing a soft-deleted contact", async () => {
    queue.rows = [[facultyRow()]];

    const result = await findSoftDeletedFacultyByContactIdSql(
      "mis",
      "01a1e3ef-e2ac-7ab6-a4f5-a89fd51e2595",
    );

    expect(result).not.toBeNull();
    expect(result?.contactId).toBe("01a1e3ef-e2ac-7ab6-a4f5-a89fd51e2595");
    expect(result?.employment?.contactId).toBe("01a1e3ef-e2ac-7ab6-a4f5-a89fd51e2595");
    expect(result?.employeeId).toBe("FAC-26-0001");
    expect(result?.contactId).not.toBe("");
  });

  it("returns null for a blank contact id without querying", async () => {
    queue.rows = [[facultyRow()]];
    await expect(findSoftDeletedFacultyByContactIdSql("mis", "   ")).resolves.toBeNull();
    expect(queue.rows).toHaveLength(1);
  });

  it("returns null when no soft-deleted faculty matches the contact", async () => {
    queue.rows = [[]];
    await expect(findSoftDeletedFacultyByContactIdSql("mis", "cnt-missing")).resolves.toBeNull();
  });

  it("lists distinct non-blank linked contact ids", async () => {
    queue.rows = [[{ contactId: "cnt-1" }, { contactId: "" }, { contactId: null }]];

    await expect(listFacultyLinkedContactIdsSql("mis")).resolves.toEqual(["cnt-1"]);
  });

  it("detects a duplicate contact link", async () => {
    queue.rows = [[{ id: "fac-existing" }]];
    await expect(findFacultyRegistrationConflictSql("mis", { contactId: "cnt-dup" })).resolves.toBe(
      "contact",
    );
  });

  it("falls through to the employee-id conflict and then null", async () => {
    queue.rows = [[], [{ id: "fac-existing" }]];
    await expect(
      findFacultyRegistrationConflictSql("mis", { contactId: "cnt-free", employeeId: "FAC-1" }),
    ).resolves.toBe("employeeId");

    queue.rows = [[], []];
    await expect(
      findFacultyRegistrationConflictSql("mis", { contactId: "cnt-free", employeeId: "FAC-2" }),
    ).resolves.toBeNull();
  });
});
