import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { studentEnrolledSessions, students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkSoftDeleteEnrollments } from "../../db/repositories/enrollmentRepositoryPersist.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enrollment-ssot-test";

async function pairs(): Promise<string[]> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({
        studentId: studentEnrolledSessions.studentId,
        sessionId: studentEnrolledSessions.sessionId,
      })
      .from(studentEnrolledSessions)
      .where(eq(studentEnrolledSessions.workspaceSubdomain, TENANT)),
  );
  return rows.map((row) => `${row.studentId}:${row.sessionId}`).sort();
}

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "SSOT test", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2", "s3"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
  });
  for (const id of ["ses-1", "ses-legacy"]) {
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id,
        name: id,
        baseFee: 1000,
        classes: [{ id: `${id}-cls`, name: "Class", discounts: [] }],
      }),
    );
  }
  // Legacy class-less membership: no enrollment row exists for it.
  await withTenant(TENANT, (tx) =>
    tx.insert(studentEnrolledSessions).values({
      id: "s3_legacy",
      workspaceSubdomain: TENANT,
      studentId: "s3",
      sessionId: "ses-legacy",
    }),
  );
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("enrollments as source of truth (real Postgres)", () => {
  it("given bulk add, should create pending enrollments with fees and derive session membership", async () => {
    // Act
    const result = await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s1", "s2", "s3"],
        sessionId: "ses-1",
        classId: "ses-1-cls",
        mode: "add",
      }),
    );
    const again = await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s1"],
        sessionId: "ses-1",
        classId: "ses-1-cls",
        mode: "add",
      }),
    );
    const fees = await withTenant(TENANT, (tx) =>
      tx.execute<{ finalFee: string; sectionId: string | null }>(sql`
      SELECT final_fee AS "finalFee", section_id AS "sectionId" FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = 's1'`),
    );

    // Assert
    expect(result).toEqual({ succeeded: 3, failed: 0 });
    expect(again).toEqual({ succeeded: 0, failed: 1 });
    expect(Number(fees.rows[0].finalFee)).toBe(1000);
    expect(fees.rows[0].sectionId).toMatch(/.+/);
    expect(await pairs()).toEqual(["s1:ses-1", "s2:ses-1", "s3:ses-1", "s3:ses-legacy"]);
  });

  it("given cancel and soft-delete, should drop derived pairs but keep the legacy class-less pair", async () => {
    // Arrange
    const [s2] = (
      await withTenant(TENANT, (tx) =>
        tx.execute<{ id: string }>(sql`
      SELECT id FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = 's2'`),
      )
    ).rows;

    // Act
    await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s1"],
        sessionId: "ses-1",
        mode: "remove",
      }),
    );
    await bulkSoftDeleteEnrollments(TENANT, [s2.id], "admin", "test");

    // Assert
    expect(await pairs()).toEqual(["s3:ses-1", "s3:ses-legacy"]);
    const [s1] = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.workspaceSubdomain, TENANT), eq(students.id, "s1"))),
    );
    expect(s1.id).toBe("s1");
  });
});
