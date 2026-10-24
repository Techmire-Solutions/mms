import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAncestorChain } from "../db/repositories/facultyRepositorySubordinates.js";
import { listFacultyPage } from "../db/repositories/facultyRepositoryListQueryPage.js";
import { guardFacultyAssignmentDependents } from "../db/repositories/facultyDeleteGuard.js";

const { tx } = vi.hoisted(() => ({ tx: { execute: vi.fn(), select: vi.fn() } }));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, work: (value: typeof tx) => Promise<unknown>) => work(tx),
  withTenantRead: (_tenant: string, work: (value: typeof tx) => Promise<unknown>) => work(tx),
}));
beforeEach(() => {
  tx.execute.mockReset();
  tx.select.mockReset();
});

describe("Faculty repository review regressions", () => {
  it("given a PostgreSQL result envelope, returns ancestor IDs when checking a supervisor", async () => {
    // Arrange — returns ancestor chain from recursive query
    tx.execute.mockResolvedValue({
      rows: [{ ancestor_id: "manager" }, { ancestor_id: "principal" }],
      rowCount: 2,
    });
    // Act / Assert
    expect(await findAncestorChain("demo", "member")).toEqual(["manager", "principal"]);
  });

  it("given stored custom fields and notes, includes them in the directory response", async () => {
    // Arrange — list path uses LATERAL SQL via tx.execute (count + page + subordinate batch)
    const stored = {
      id: "f",
      contactId: "c",
      status: "active",
      notes: "Office hours",
      customData: { office: "Room 12" },
      workspaceSubdomain: "demo",
      userId: null,
      employeeId: null,
      specialization: null,
      qualification: null,
      joinDate: null,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: false,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      createdBy: null,
      updatedBy: null,
    };
    tx.execute
      .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // count
      .mockResolvedValueOnce({ rows: [stored] }) // page
      .mockResolvedValueOnce({ rows: [] }) // subordinate batch
      .mockResolvedValue({ rows: [] }); // hydrate appointments if any
    tx.select.mockImplementation(() => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        orderBy: () => query,
        then: (resolve: (value: unknown) => void) => resolve([]),
      };
      return query;
    });
    // Act
    const result = await listFacultyPage("demo", {});
    // Assert
    expect(result.faculty[0]).toMatchObject({ id: "f", notes: "Office hours", office: "Room 12" });
  });

  it("given an assignment dependent, rejects deletion after acquiring the hierarchy lock", async () => {
    // Arrange
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "child" }] });
    // Act / Assert
    await expect(guardFacultyAssignmentDependents("demo", ["manager"])).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });

  it("given no surviving dependents, permits deletion", async () => {
    // Arrange — lock + session FK checks
    tx.execute.mockResolvedValue({ rows: [] });
    // Act / Assert
    await expect(
      guardFacultyAssignmentDependents("demo", ["manager", "child"]),
    ).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });

  it("given session faculty links, rejects deletion", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] }) // lock
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // session links
    await expect(guardFacultyAssignmentDependents("demo", ["manager"])).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("session faculty"),
    });
  });
});
