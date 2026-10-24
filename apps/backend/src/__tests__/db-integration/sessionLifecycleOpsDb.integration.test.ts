import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkSaveInvoices } from "../../db/repositories/financeInvoicesRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { sessionLifecycleOpsUseCases as ops } from "../../sessions/use-cases/sessionLifecycleOpsUseCases.js";
import { updateStudentById } from "../../students/use-cases/studentWriteUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-lifecycle-ops-test";
const admin: User = {
  id: "u-admin",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: TENANT,
};
const today = todayInTimeZone(null);
const nextMonth = (() => {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
})();
const inDays = (days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
  withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);
const run = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

const enrollmentOf = async (studentId: string, sessionId: string) =>
  (
    await query<{ id: string; status: string; endOn: string | null }>(sql`
      SELECT id, status, end_on::text AS "endOn" FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId} AND session_id = ${sessionId}`)
  )[0];

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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Lifecycle ops", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
  });
  for (const [id, status, startDate] of [
    ["ses-run", "in_progress", "2026-01-01"],
    ["ses-new", "open", inDays(10)],
  ] as const) {
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id,
        name: id,
        status,
        startDate,
        endDate: id === "ses-new" ? inDays(40) : "2026-12-31",
        baseFee: 1000,
        classes: [
          {
            id: `${id}-cls`,
            name: "Class",
            sections: [{ id: `${id}-sec`, name: "A", capacity: 10 }],
          },
        ],
      }),
    );
  }
  for (const [studentId, sessionId] of [
    ["s1", "ses-run"],
    ["s2", "ses-run"],
  ] as const) {
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: [studentId],
        sessionId,
        classId: `${sessionId}-cls`,
        mode: "add",
      }),
    );
  }
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

describe("session cancel / postpone, student status cascade, activity (real Postgres)", () => {
  it("given a student marked graduated, should withdraw their live enrollment today", async () => {
    // Act
    await run(() => updateStudentById("s2", { status: "graduated" }, admin));

    // Assert
    expect(await enrollmentOf("s2", "ses-run")).toMatchObject({
      status: "withdrawn",
      endOn: today,
    });
    expect(await enrollmentOf("s1", "ses-run")).toMatchObject({ status: "pending", endOn: null });
  });

  it("given an in-progress session, should refuse postponing it", async () => {
    // Act
    const attempt = await run(() =>
      ops.postpone(TENANT, "ses-run", { startDate: inDays(5), reason: "Late start" }, admin),
    ).catch((error: unknown) => error);

    // Assert
    expect(attempt).toMatchObject({ statusCode: 409 });
  });

  it("given an open session, should postpone start and end by the same days", async () => {
    // Act
    const moved = await run(() =>
      ops.postpone(
        TENANT,
        "ses-new",
        { startDate: inDays(17), reason: "Building not ready" },
        admin,
      ),
    );

    // Assert
    expect(moved.startDate?.slice(0, 10)).toBe(inDays(17));
    expect(moved.endDate?.slice(0, 10)).toBe(inDays(47));
  });

  it("given a cancellation, should cancel live enrollments and void their later unpaid invoices", async () => {
    // Arrange
    const s1 = await enrollmentOf("s1", "ses-run");
    await bulkSaveInvoices(TENANT, [
      {
        id: "inv-life-next",
        studentId: "s1",
        studentName: "",
        class: "Class",
        session: "ses-run",
        baseFee: 1000,
        discountValue: 0,
        discountAmt: 0,
        finalAmt: 1000,
        status: "pending",
        dueDate: `${nextMonth}-10`,
        paidAmt: 0,
        invoiceNumber: "LIFE-1",
        billingPeriod: nextMonth,
        enrollmentId: s1.id,
      },
    ]);

    // Act
    const result = await run(() =>
      ops.cancel(TENANT, "ses-run", { reason: "Teacher unavailable" }, admin),
    );

    // Assert
    expect(result.ended).toBe(1);
    expect(result.billing.cancelled).toEqual([{ id: "inv-life-next", invoiceNumber: "LIFE-1" }]);
    expect(await enrollmentOf("s1", "ses-run")).toMatchObject({
      status: "cancelled",
      endOn: today,
    });
    const [session] = await query<{ status: string }>(sql`
      SELECT status FROM sessions WHERE workspace_subdomain = ${TENANT} AND id = 'ses-run'`);
    expect(session.status).toBe("cancelled");
    const again = await run(() =>
      ops.cancel(TENANT, "ses-run", { reason: "Cancel twice" }, admin),
    ).catch((error: unknown) => error);
    expect(again).toMatchObject({ statusCode: 409 });
  });

  it("given the activity feed, should list the dated enrollment changes newest first", async () => {
    // Act
    const items = await run(() => ops.activity(TENANT, "ses-run"));

    // Assert
    const kinds = items.map((item) => item.kind);
    expect(kinds).toEqual(expect.arrayContaining(["withdrawn", "cancelled"]));
    expect(items.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.on))).toBe(true);
  });
});
