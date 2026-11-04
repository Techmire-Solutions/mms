import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  saveFacultyAssignment,
  closeAssignment,
  findFacultyAssignmentById,
  softDeleteFacultyAssignment,
} from "../../db/repositories/facultyAssignmentRepository.js";
import {
  saveFacultyDepartment,
  softDeleteFacultyDepartment,
} from "../../db/repositories/facultyDepartmentRepository.js";
import {
  listFacultyDesignations,
  saveFacultyDesignation,
  softDeleteFacultyDesignation,
} from "../../db/repositories/facultyDesignationRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  seedFacultyHierarchy,
  cleanupFacultyHierarchy,
  facultyTestTenant as tenant,
} from "./facultyHierarchyFixtures.js";

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFacultyHierarchy();
});
afterAll(async () => {
  await cleanupFacultyHierarchy();
  await closeDatabase();
});

function appointment(id: string, overrides = {}) {
  return {
    id,
    workspaceSubdomain: tenant,
    facultyId: "f0",
    departmentId: "d",
    designationId: "g",
    startDate: "2025-01-01",
    isPrimary: false,
    ...overrides,
  };
}

describe("Faculty appointment integrity", () => {
  it("rejects overlapping primary periods but allows secondary appointments", async () => {
    await expect(
      saveFacultyAssignment(tenant, appointment("primary", { isPrimary: true })),
    ).rejects.toThrow("overlaps");
    await expect(saveFacultyAssignment(tenant, appointment("secondary"))).resolves.toBeUndefined();
  });

  it("retains historical primary dates and rejects an inclusive boundary overlap", async () => {
    await closeAssignment(tenant, "a0", "2024-12-31");
    await expect(
      saveFacultyAssignment(
        tenant,
        appointment("boundary", {
          startDate: "2024-12-31",
          endDate: "2025-01-01",
          isPrimary: true,
        }),
      ),
    ).rejects.toThrow("overlaps");
    await expect(
      saveFacultyAssignment(tenant, appointment("next", { isPrimary: true })),
    ).resolves.toBeUndefined();
  });

  it("serializes simultaneous primary saves on separate connections", async () => {
    await closeAssignment(tenant, "a1", "2024-12-31");
    const results = await Promise.allSettled([
      saveFacultyAssignment(tenant, appointment("race-a", { facultyId: "f1", isPrimary: true })),
      saveFacultyAssignment(tenant, appointment("race-b", { facultyId: "f1", isPrimary: true })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("rejects missing references and an end date before the start", async () => {
    await expect(
      saveFacultyAssignment(tenant, appointment("missing", { departmentId: "missing" })),
    ).rejects.toThrow("active");
    await expect(
      saveFacultyAssignment(tenant, appointment("bad-date", { endDate: "2020-01-01" })),
    ).rejects.toThrow("End date");
  });

  it("does not let closing an earlier period extend it into a later primary role", async () => {
    await expect(closeAssignment(tenant, "a0", "2025-01-01")).rejects.toThrow("overlaps");
  });

  it("refuses to archive the period backing a current primary appointment, then allows it once ended", async () => {
    // a2 is f2's only appointment: primary, open since 2020 — i.e. the row the
    // Work projection/exports/contact tags currently resolve.
    await expect(softDeleteFacultyAssignment(tenant, "a2", "actor")).rejects.toThrow(
      /primary appointment/i,
    );
    expect((await findFacultyAssignmentById(tenant, "a2"))?.deletedAt ?? null).toBeNull();

    await closeAssignment(tenant, "a2", "2024-12-31");
    await expect(softDeleteFacultyAssignment(tenant, "a2", "actor")).resolves.toBeUndefined();
    expect((await findFacultyAssignmentById(tenant, "a2"))?.deletedAt).not.toBeNull();
  });

  it("commits the audit record with the appointment and distinguishes create from update", async () => {
    const actionTypes = () =>
      withTenant(tenant, async (tx) => {
        const result = await tx.execute(sql`SELECT action_type FROM audit_trail_events
          WHERE workspace_subdomain = ${tenant} AND table_name = 'faculty_assignments' AND record_id = 'secondary'
          ORDER BY transaction_timestamp, id, action_type`);
        return result.rows.map((row) => (row as { action_type: string }).action_type);
      });

    expect(await actionTypes()).toEqual(["CREATE"]);

    await saveFacultyAssignment(tenant, appointment("secondary", { notes: "edited" }));
    expect(await actionTypes()).toEqual(["CREATE", "UPDATE"]);
  });
});

describe("Faculty department integrity", () => {
  it("serializes concurrent saves so two live departments cannot share a name", async () => {
    const results = await Promise.allSettled([
      saveFacultyDepartment(tenant, { id: "left", name: "Shared Name" }),
      saveFacultyDepartment(tenant, { id: "right", name: "shared name" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("derives a code from the name, keeps it stable on rename, and blocks dependent deletion", async () => {
    const saved = await saveFacultyDepartment(tenant, {
      id: "child",
      name: "Child Dept",
      description: "x",
      status: "inactive",
    });
    expect(saved).toMatchObject({
      id: "child",
      name: "Child Dept",
      description: "x",
      status: "inactive",
      code: "child-dept",
    });
    const renamed = await saveFacultyDepartment(tenant, { id: "child", name: "Renamed Child" });
    expect(renamed.code).toBe("child-dept");
    await expect(saveFacultyDepartment(tenant, { id: "dup", name: "Department" })).rejects.toThrow(
      "already exists",
    );
    await expect(softDeleteFacultyDepartment(tenant, "d", "actor")).rejects.toThrow(
      "active designations",
    );
  });

  it("derives designation hierarchy rank from the parent chain and rejects cycles", async () => {
    await saveFacultyDesignation(tenant, {
      id: "junior",
      departmentId: "d",
      name: "Junior",
      parentDesignationId: "g",
      status: "active",
    });
    await saveFacultyDesignation(tenant, {
      id: "intern",
      departmentId: "d",
      name: "Intern",
      parentDesignationId: "junior",
      status: "active",
    });
    const byId = new Map((await listFacultyDesignations(tenant)).map((d) => [d.id, d]));
    expect(byId.get("junior")).toMatchObject({
      hierarchyRank: 2,
      departmentName: "Department",
      parentDesignationName: "Professor",
    });
    expect(byId.get("intern")?.hierarchyRank).toBe(3);
    await expect(
      saveFacultyDesignation(tenant, {
        id: "g",
        departmentId: "d",
        name: "Professor",
        parentDesignationId: "intern",
        status: "active",
      }),
    ).rejects.toThrow("Circular");
    await expect(
      saveFacultyDesignation(tenant, {
        id: "dup",
        departmentId: "d",
        name: "junior",
        parentDesignationId: null,
        status: "active",
      }),
    ).rejects.toThrow("already exists");
  });

  it("orders designations by department, seniority and name, excluding soft-deleted definitions", async () => {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`INSERT INTO faculty_designations (workspace_subdomain, id, department_id, code, name, hierarchy_rank)
        VALUES (${tenant}, 'archived', 'd', 'A', 'Archived', 10)`);
      await tx.execute(
        sql`UPDATE faculty_designations SET deleted_at = now() WHERE workspace_subdomain = ${tenant} AND id = 'archived'`,
      );
    });
    expect((await listFacultyDesignations(tenant)).map((d) => d.id)).toEqual([
      "g",
      "junior",
      "intern",
    ]);
  });

  it("archives unused designations with an outbox event and permits name reuse", async () => {
    await expect(softDeleteFacultyDesignation(tenant, "g", "actor")).rejects.toThrow("dependent");
    await expect(softDeleteFacultyDesignation(tenant, "junior", "actor")).rejects.toThrow(
      "dependent",
    );
    await softDeleteFacultyDesignation(tenant, "intern", "actor");
    await softDeleteFacultyDesignation(tenant, "junior", "actor");
    await expect(
      saveFacultyDesignation(tenant, {
        id: "junior",
        departmentId: "d",
        name: "Junior",
        parentDesignationId: null,
        status: "active",
      }),
    ).rejects.toThrow("archived");
    await saveFacultyDesignation(tenant, {
      id: "replacement",
      departmentId: "d",
      name: "Junior",
      parentDesignationId: null,
      status: "active",
    });
    await withTenant(tenant, async (tx) => {
      const events =
        await tx.execute(sql`SELECT id FROM outbox_events WHERE workspace_subdomain = ${tenant}
        AND event_type = 'entity.soft_deleted' AND payload ->> 'entityId' = 'junior'`);
      expect(events.rows).toHaveLength(1);
    });
  });
});
