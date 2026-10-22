import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { enrollmentOperationsUseCases as ops } from "../../enrollments/use-cases/enrollmentOperationsUseCases.js";
import { enrollmentLifecycleUseCases as lifecycle } from "../../enrollments/use-cases/enrollmentLifecycleUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enrollment-lifecycle-test";
const admin: User = {
  id: "u-admin",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: TENANT,
};
const today = todayInTimeZone(null);
const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
  .toISOString()
  .slice(0, 10);

const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
  withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);

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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Lifecycle test", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2"].map((id) => ({
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
      id: "ses-life",
      name: "Lifecycle session",
      status: "in_progress",
      baseFee: 1000,
      classes: [
        { id: "cls-a", name: "Class A", sections: [{ id: "sec-a1", name: "A1", capacity: 1 }] },
      ],
    }),
  );
  await runWithTenant(TENANT, () =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1"],
      sessionId: "ses-life",
      classId: "cls-a",
      mode: "add",
    }),
  );
  await query(
    sql`UPDATE enrollment_placements SET start_on = '2026-01-01' WHERE workspace_subdomain = ${TENANT}`,
  );
  await query(
    sql`UPDATE enrollments SET enrolled_on = '2026-01-01' WHERE workspace_subdomain = ${TENANT}`,
  );
  // A waitlisted public application for the (full) class.
  await query(sql`
    INSERT INTO session_registration_links (id, workspace_subdomain, session_id, slug)
    VALUES ('link-life', ${TENANT}, 'ses-life', 'life-slug-123456')`);
  await query(sql`
    INSERT INTO registration_applications
      (id, workspace_subdomain, reference, link_id, session_id, class_id, full_name, guardian_name, date_of_birth, gender, phone, status)
    VALUES ('app-wait', ${TENANT}, 'REG-WAIT', 'link-life', 'ses-life', 'cls-a', 'Waiting Student', 'Guardian', '2015-05-05', 'male', '0300', 'waitlisted')`);
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("enrollment suspension, withdrawal waitlist offer and re-admission (real Postgres)", () => {
  it("given a suspension, should record approved leave and refuse an overlapping one", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");
    const body = { fromOn: "2026-02-01", toOn: "2026-02-10", reason: "Family travel abroad" };

    // Act
    const suspended = await runWithTenant(TENANT, () => lifecycle.suspend(TENANT, id, body, admin));
    const overlap = runWithTenant(TENANT, () =>
      lifecycle.suspend(TENANT, id, { ...body, fromOn: "2026-02-05", toOn: "2026-02-20" }, admin),
    );

    // Assert
    await expect(overlap).rejects.toMatchObject({ statusCode: 409 });
    expect(suspended.timeline.at(-1)).toMatchObject({
      eventType: "suspended",
      effectiveOn: "2026-02-01",
    });
    const leaves = await query<{ status: string; from: string; to: string }>(sql`
      SELECT status, from_date::text AS "from", to_date::text AS "to"
        FROM attendance_leaves WHERE workspace_subdomain = ${TENANT} AND student_id = 's1'`);
    expect(leaves).toEqual([{ status: "approved", from: "2026-02-01", to: "2026-02-10" }]);
  });

  it("given a withdrawal from a full class, should flag the oldest waitlisted application for review", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");

    // Act
    await runWithTenant(TENANT, () =>
      ops.withdraw(TENANT, id, { effectiveOn: yesterday, reason: "Moved to another city" }, admin),
    );

    // Assert
    const [application] = await query<{ status: string; note: string | null }>(sql`
      SELECT status, review_reason AS note FROM registration_applications WHERE id = 'app-wait'`);
    expect(application.status).toBe("under_review");
    expect(application.note).toMatch(/^Seat available/);
  });

  it("given re-admission after the last day, should confirm again with a new open placement", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");

    // Act
    const tooEarly = await runWithTenant(TENANT, () =>
      lifecycle.readmit(TENANT, id, { effectiveOn: yesterday, reason: "Family returned" }, admin),
    ).catch((error: unknown) => error);
    const back = await runWithTenant(TENANT, () =>
      lifecycle.readmit(TENANT, id, { effectiveOn: today, reason: "Family returned" }, admin),
    );

    // Assert
    expect(tooEarly).toMatchObject({ statusCode: 400 });
    expect(back).toMatchObject({
      status: "confirmed",
      endOn: null,
      classId: "cls-a",
      sectionId: "sec-a1",
      finalFee: 1000,
    });
    expect(back.timeline.at(-1)).toMatchObject({ eventType: "readmitted", effectiveOn: today });
    const open = await query<{ start: string }>(sql`
      SELECT start_on::text AS start FROM enrollment_placements
       WHERE workspace_subdomain = ${TENANT} AND enrollment_id = ${id} AND end_on IS NULL`);
    expect(open).toEqual([{ start: today }]);
  });
});
