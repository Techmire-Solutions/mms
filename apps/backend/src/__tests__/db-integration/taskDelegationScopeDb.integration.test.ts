import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant } from "../../db/tenant-context.js";
import {
  contacts,
  faculty,
  facultyAssignments,
  facultyDepartments,
  facultyDesignations,
  facultyEmployments,
  tenantUsers,
  workspaces,
} from "../../db/schema.js";
import { findEligibleTaskRecipientRows } from "../../db/repositories/taskRecipientRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `task-delegation-${randomUUID().slice(0, 8)}`;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM faculty_assignments WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM faculty WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM faculty_employments WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM faculty_designations WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM faculty_departments WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM tenant_users WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM contacts WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

const PEOPLE = [
  { key: "actor", designation: "desig-head" },
  { key: "report", designation: "desig-lecturer" },
  { key: "child", designation: "desig-assistant" },
  { key: "outsider", designation: "desig-other" },
] as const;

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();

  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Task delegation", enabled: true });
    await tx.insert(facultyDepartments).values([
      { id: "dept-main", workspaceSubdomain: TENANT, name: "Main", code: "MAIN" },
      { id: "dept-other", workspaceSubdomain: TENANT, name: "Other", code: "OTHER" },
    ]);
    // head → lecturer → assistant, plus an unrelated root designation.
    await tx.insert(facultyDesignations).values([
      {
        id: "desig-head",
        workspaceSubdomain: TENANT,
        departmentId: "dept-main",
        name: "Head",
        hierarchyRank: 1,
      },
      {
        id: "desig-lecturer",
        workspaceSubdomain: TENANT,
        departmentId: "dept-main",
        parentDesignationId: "desig-head",
        name: "Lecturer",
        hierarchyRank: 2,
      },
      {
        id: "desig-assistant",
        workspaceSubdomain: TENANT,
        departmentId: "dept-main",
        parentDesignationId: "desig-lecturer",
        name: "Assistant",
        hierarchyRank: 3,
      },
      {
        id: "desig-other",
        workspaceSubdomain: TENANT,
        departmentId: "dept-other",
        name: "Other root",
        hierarchyRank: 1,
      },
    ]);
    await tx.insert(contacts).values(
      PEOPLE.map((person) => ({
        id: `contact-${person.key}`,
        workspaceSubdomain: TENANT,
        firstName: person.key,
        name: person.key,
      })),
    );
    await tx.insert(facultyEmployments).values(
      PEOPLE.map((person) => ({
        id: `employ-${person.key}`,
        workspaceSubdomain: TENANT,
        contactId: `contact-${person.key}`,
        employeeId: `EMP-${person.key}`,
        employmentStartDate: "2020-01-01",
        status: "active" as const,
      })),
    );
    await tx.insert(tenantUsers).values(
      PEOPLE.map((person) => ({
        id: `user-${person.key}`,
        workspaceSubdomain: TENANT,
        loginEmail: `${person.key}@example.test`,
        passwordHash: "hashed",
        name: person.key,
        role: "teacher",
        contactId: `contact-${person.key}`,
        profileJson: { status: "active" },
      })),
    );
    await tx.insert(faculty).values(
      PEOPLE.map((person) => ({
        id: `faculty-${person.key}`,
        workspaceSubdomain: TENANT,
        employmentId: `employ-${person.key}`,
        userId: `user-${person.key}`,
      })),
    );
    await tx.insert(facultyAssignments).values(
      PEOPLE.map((person) => ({
        id: `assignment-${person.key}`,
        workspaceSubdomain: TENANT,
        facultyId: `faculty-${person.key}`,
        departmentId: person.designation === "desig-other" ? "dept-other" : "dept-main",
        designationId: person.designation,
        isPrimary: true,
        status: "active" as const,
        startDate: "2020-01-01",
      })),
    );
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

async function eligibleUserIds(options: {
  canAssignAnywhere?: boolean;
  delegationScope?: "descendants" | "direct_reports";
  allowSelfAssignment?: boolean;
}): Promise<string[]> {
  const rows = await findEligibleTaskRecipientRows(TENANT, "user-actor", options);
  return rows.map((row) => String(row.userId)).sort();
}

describe("Task delegation scope", () => {
  it("limits descendants scope to the actor plus the designation subtree", async () => {
    await expect(eligibleUserIds({ delegationScope: "descendants" })).resolves.toEqual([
      "user-actor",
      "user-child",
      "user-report",
    ]);
  });

  it("limits direct_reports scope to the actor plus one designation level", async () => {
    await expect(eligibleUserIds({ delegationScope: "direct_reports" })).resolves.toEqual([
      "user-actor",
      "user-report",
    ]);
  });

  it("lets tasks.assign_anywhere reach every active recipient", async () => {
    await expect(
      eligibleUserIds({ canAssignAnywhere: true, delegationScope: "direct_reports" }),
    ).resolves.toEqual(["user-actor", "user-child", "user-outsider", "user-report"]);
  });

  it("drops the actor when self-assignment is disabled", async () => {
    await expect(
      eligibleUserIds({ delegationScope: "direct_reports", allowSelfAssignment: false }),
    ).resolves.toEqual(["user-report"]);
  });

  it("degrades to self-only when the actor has no designation", async () => {
    await withGlobalTenant(async (tx) => {
      await tx
        .update(facultyAssignments)
        .set({ status: "inactive" })
        .where(eq(facultyAssignments.facultyId, "faculty-actor"));
    });
    try {
      await expect(eligibleUserIds({ delegationScope: "descendants" })).resolves.toEqual([
        "user-actor",
      ]);
    } finally {
      await withGlobalTenant(async (tx) => {
        await tx
          .update(facultyAssignments)
          .set({ status: "active" })
          .where(eq(facultyAssignments.facultyId, "faculty-actor"));
      });
    }
  });
});
