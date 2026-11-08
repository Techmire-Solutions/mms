import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { enrollmentOperationsUseCases as ops } from "../../enrollments/use-cases/enrollmentOperationsUseCases.js";
import { enrollmentsUseCases } from "../../enrollments/use-cases/enrollmentsUseCases.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { endLiveEnrollments } from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enrollment-rules-test";
const SESSION = "ses-rules";
const CLASS = "cls-rules";
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
  return row!.id;
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Rules test", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2", "s3", "s4"].map((id) => ({
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
      id: SESSION,
      name: "Rules session",
      status: "in_progress",
      startDate: "2026-01-01",
      classes: [
        {
          id: CLASS,
          name: "Class A",
          minAge: 0,
          maxAge: 100,
          gender: "mixed",
          sections: [{ id: "sec-a", name: "A", capacity: 10 }],
        },
      ],
    }),
  );
  await runWithTenant(TENANT, () =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1", "s2"],
      sessionId: SESSION,
      classId: CLASS,
      mode: "add",
    }),
  );
  // s2's enrollment is completed history: it must never be withdrawn/cancelled by a batch.
  await query(sql`
    UPDATE enrollments SET status = 'completed'
     WHERE workspace_subdomain = ${TENANT} AND student_id = 's2'`);
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("enrollment lifecycle rules (real Postgres)", () => {
  it("refuses a manual transition out of a terminal status", async () => {
    const id = await enrollmentIdOf("s2");

    await expect(
      runWithTenant(TENANT, () =>
        enrollmentsUseCases.updateEnrollmentById(id, { status: "confirmed" } as never),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "invalid_status_transition" });

    const [row] = await query<{ status: string }>(sql`
      SELECT status FROM enrollments WHERE workspace_subdomain = ${TENANT} AND id = ${id}`);
    expect(row?.status).toBe("completed");
  });

  it("ends only operable enrollments when a session is cancelled", async () => {
    const result = await runWithTenant(TENANT, () =>
      endLiveEnrollments(
        TENANT,
        { sessionIds: [SESSION] },
        {
          status: "cancelled",
          lastDay: today,
          reason: "Session cancelled",
          actor: { userId: null, label: "Test" },
        },
      ),
    );
    expect(result.ended).toBe(1);

    const [completed] = await query<{ status: string }>(sql`
      SELECT status FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND student_id = 's2'`);
    expect(completed?.status).toBe("completed");
  });

  it("enforces the class add deadline with an explicit override", async () => {
    await query(sql`
      UPDATE session_classes SET enrollment_deadline = ${yesterday}
       WHERE workspace_subdomain = ${TENANT} AND id = ${CLASS}`);

    await expect(
      runWithTenant(TENANT, () =>
        bulkEnrollStudentsIntoClass(TENANT, {
          studentIds: ["s3"],
          sessionId: SESSION,
          classId: CLASS,
          mode: "add",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "conflict" });

    const overridden = await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s3"],
        sessionId: SESSION,
        classId: CLASS,
        mode: "add",
        allowAfterDeadline: true,
      }),
    );
    expect(overridden).toEqual({ succeeded: 1, failed: 0 });
  });

  it("enforces the class drop deadline with an explicit override", async () => {
    await query(sql`
      UPDATE session_classes SET drop_deadline = ${yesterday}
       WHERE workspace_subdomain = ${TENANT} AND id = ${CLASS}`);
    const id = await enrollmentIdOf("s3");

    await expect(
      runWithTenant(TENANT, () =>
        ops.withdraw(TENANT, id, { reason: "Family moved", effectiveOn: today }, admin),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "drop_deadline_passed" });

    const withdrawn = await runWithTenant(TENANT, () =>
      ops.withdraw(
        TENANT,
        id,
        { reason: "Family moved", effectiveOn: today, overrideDropDeadline: true },
        admin,
      ),
    );
    expect(withdrawn.enrollment.status).toBe("withdrawn");
  });

  it("refuses to enrol into a session that no longer accepts enrolments", async () => {
    await query(sql`
      UPDATE sessions SET status = 'completed'
       WHERE workspace_subdomain = ${TENANT} AND id = ${SESSION}`);

    await expect(
      runWithTenant(TENANT, () =>
        bulkEnrollStudentsIntoClass(TENANT, {
          studentIds: ["s4"],
          sessionId: SESSION,
          classId: CLASS,
          mode: "add",
          allowAfterDeadline: true,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses overlapping timetable periods within one class", async () => {
    await expect(
      saveSession(
        TENANT,
        SessionSchema.parse({
          id: "ses-timetable",
          name: "Timetable session",
          status: "open",
          classes: [
            {
              id: "cls-timetable",
              name: "Timetable class",
              timetables: [
                {
                  id: "tt-1",
                  date: "2026-04-01",
                  periods: [
                    { id: "p1", startTime: "08:00", endTime: "09:00", subject: "Quran" },
                    { id: "p2", startTime: "08:30", endTime: "09:30", subject: "Fiqh" },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
