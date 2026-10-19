import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { sectionOperationsUseCases as sectionOps } from "../../sessions/use-cases/sectionOperationsUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "section-ops-test";
const admin: User = {
  id: "u-admin",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: TENANT,
};
const today = todayInTimeZone(null);
const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
  withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);
const run = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

async function sectionOf(studentId: string): Promise<string | null> {
  const [row] = await query<{ sectionId: string | null }>(sql`
    SELECT section_id AS "sectionId" FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId}`);
  return row.sectionId;
}

async function enrollmentIdOf(studentId: string): Promise<string> {
  const [row] = await query<{ id: string }>(sql`
    SELECT id FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId}`);
  return row.id;
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Section ops", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2", "s3"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "ses-sec",
      name: "Sections session",
      status: "in_progress",
      classes: [
        {
          id: "cls-1",
          name: "Class 1",
          sections: [
            { id: "sec-a", name: "A", capacity: 5 },
            { id: "sec-b", name: "B", capacity: 2 },
            { id: "sec-c", name: "C", capacity: 1 },
          ],
        },
      ],
    }),
  );
  await run(() =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1", "s2", "s3"],
      sessionId: "ses-sec",
      classId: "cls-1",
      sectionId: "sec-a",
      mode: "add",
    }),
  );
  await query(
    sql`UPDATE enrollment_placements SET start_on = '2026-01-01' WHERE workspace_subdomain = ${TENANT}`,
  );
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("section merge / split / close (real Postgres)", () => {
  it("given a target without enough seats, should refuse the merge and say how many are missing", async () => {
    // Act
    const attempt = await run(() =>
      sectionOps.merge(
        TENANT,
        "sec-a",
        { targetSectionId: "sec-c", effectiveOn: today, reason: "Combine small groups" },
        admin,
      ),
    ).catch((error: unknown) => error);

    // Assert
    expect(attempt).toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/2 more seat/),
    });
    expect(await sectionOf("s1")).toBe("sec-a");
  });

  it("given a split, should create the section and move only the chosen students", async () => {
    // Arrange
    const s3 = await enrollmentIdOf("s3");

    // Act
    const result = await run(() =>
      sectionOps.split(
        TENANT,
        "sec-a",
        {
          name: "D",
          capacity: 5,
          enrollmentIds: [s3],
          effectiveOn: today,
          reason: "Too many in A",
        },
        admin,
      ),
    );

    // Assert
    expect(result.moved).toBe(1);
    expect(await sectionOf("s3")).toBe(result.sectionId);
    expect(await sectionOf("s1")).toBe("sec-a");
    const history = await query<{ sectionId: string; endOn: string | null }>(sql`
      SELECT section_id AS "sectionId", end_on::text AS "endOn" FROM enrollment_placements
       WHERE workspace_subdomain = ${TENANT} AND enrollment_id = ${s3} ORDER BY start_on`);
    expect(history.map((row) => row.sectionId)).toEqual(["sec-a", result.sectionId]);
    expect(history[1].endOn).toBeNull();
  });

  it("given a merge that fits, should move everyone and close the source on that date", async () => {
    // Act
    const result = await run(() =>
      sectionOps.merge(
        TENANT,
        "sec-a",
        { targetSectionId: "sec-b", effectiveOn: today, reason: "Teacher left" },
        admin,
      ),
    );

    // Assert
    expect(result).toEqual({ sectionId: "sec-b", moved: 2 });
    expect([await sectionOf("s1"), await sectionOf("s2")]).toEqual(["sec-b", "sec-b"]);
    const [source] = await query<{ status: string; closedOn: string; reason: string }>(sql`
      SELECT status, closed_on::text AS "closedOn", closed_reason AS reason
        FROM session_class_sections WHERE workspace_subdomain = ${TENANT} AND id = 'sec-a'`);
    expect(source).toEqual({ status: "closed", closedOn: today, reason: "Teacher left" });
  });

  it("given close, should close an empty section and refuse one that still has students", async () => {
    // Act
    const closed = await run(() =>
      sectionOps.close(TENANT, "sec-c", { effectiveOn: today, reason: "Not needed" }, admin),
    );
    const occupied = await run(() =>
      sectionOps.close(TENANT, "sec-b", { effectiveOn: today, reason: "Not needed" }, admin),
    ).catch((error: unknown) => error);

    // Assert
    expect(closed).toEqual({ sectionId: "sec-c", moved: 0 });
    expect(occupied).toMatchObject({ statusCode: 409 });
  });
});
