import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  seedFacultyHierarchy,
  cleanupFacultyHierarchy,
  facultyTestTenant as tenant,
} from "./facultyHierarchyFixtures.js";
import { findAncestorChain } from "../../db/repositories/facultyRepositorySubordinates.js";
import { guardFacultyAssignmentDependents } from "../../db/repositories/facultyDeleteGuard.js";
import { listFacultyPage } from "../../db/repositories/facultyRepositoryListQueryPage.js";
import { saveFaculty } from "../../db/repositories/facultyRepository.js";
import {
  findCurrentFacultyDesignationAssignment,
  listFacultyDesignationAssignments,
} from "../../db/repositories/facultyDesignationAssignmentRepository.js";

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFacultyHierarchy();
});
afterAll(async () => {
  await cleanupFacultyHierarchy();
  await closeDatabase();
});

describe("Faculty review fixes against PostgreSQL", () => {
  it("given position-based reporting removed, returns empty ancestor chain", async () => {
    expect(await findAncestorChain(tenant, "f1")).toEqual([]);
  });

  it("given an existing ID, insert-only persistence cannot reactivate or replace it", async () => {
    // Arrange
    await withTenant(tenant, (tx) =>
      tx.execute(sql`UPDATE faculty SET deleted_at = now()
      WHERE workspace_subdomain = ${tenant} AND id = 'f24'`),
    );
    // Act / Assert
    await expect(
      saveFaculty(
        tenant,
        { id: "f24", contactId: "c23", employeeId: "DIFFERENT", status: "active" },
        { createOnly: true },
      ),
    ).rejects.toThrow();
    await withTenant(tenant, async (tx) => {
      const result = await tx.execute(sql`SELECT e.contact_id, f.deleted_at IS NOT NULL AS archived
        FROM faculty f
        JOIN faculty_employments e ON e.workspace_subdomain = f.workspace_subdomain AND e.id = f.employment_id
        WHERE f.workspace_subdomain = ${tenant} AND f.id = 'f24'`);
      expect(result.rows).toEqual([{ contact_id: "c24", archived: true }]);
      await tx.execute(
        sql`UPDATE faculty SET deleted_at = NULL WHERE workspace_subdomain = ${tenant} AND id = 'f24'`,
      );
    });
  });

  it("guards faculty assignment deletion when session faculty links exist", async () => {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`
        INSERT INTO sessions (workspace_subdomain, id, name, status, created_at, updated_at)
        VALUES (${tenant}, 'sess-test', 'Test Session', 'in_progress', now(), now())
        ON CONFLICT DO NOTHING
      `);
      await tx.execute(sql`
        INSERT INTO session_faculty (workspace_subdomain, id, session_id, faculty_id, faculty_name, role, status, created_at)
        VALUES (${tenant}, 'sf-test', 'sess-test', 'f0', 'Faculty 0', 'coordinator', 'active', now())
        ON CONFLICT DO NOTHING
      `);
    });
    try {
      await expect(guardFacultyAssignmentDependents(tenant, ["f0"])).rejects.toMatchObject({
        statusCode: 409,
      });
      await expect(guardFacultyAssignmentDependents(tenant, ["f1"])).resolves.toBeUndefined();
    } finally {
      await withTenant(tenant, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.execute(
          sql`DELETE FROM session_faculty WHERE workspace_subdomain = ${tenant} AND id = 'sf-test'`,
        );
        await tx.execute(
          sql`DELETE FROM sessions WHERE workspace_subdomain = ${tenant} AND id = 'sess-test'`,
        );
      });
    }
  });

  it("given stored custom fields and notes, returns their values in list pages", async () => {
    // Arrange
    await withTenant(tenant, (tx) =>
      tx.execute(sql`UPDATE faculty SET notes = 'Office hours',
      custom_data = '{"office":"Room 12"}'::jsonb WHERE workspace_subdomain = ${tenant} AND id = 'f0'`),
    );
    // Act / Assert
    const page = await listFacultyPage(tenant, {});
    expect(page.faculty.find((row) => row.id === "f0")).toMatchObject({
      office: "Room 12",
      notes: "Office hours",
    });
  });

  it("given primary faculty_assignments, projects designation-history from FA rows", async () => {
    // Act
    const history = await listFacultyDesignationAssignments(tenant, "f0");
    const current = await findCurrentFacultyDesignationAssignment(tenant, "f0", "2024-06-01");

    // Assert
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: "a0",
      facultyId: "f0",
      designationId: "g",
      designationName: "Professor",
      startsOn: "2020-01-01",
      endsOn: null,
    });
    expect(current).toMatchObject({ id: "a0", designationId: "g", designationName: "Professor" });
  });
});
