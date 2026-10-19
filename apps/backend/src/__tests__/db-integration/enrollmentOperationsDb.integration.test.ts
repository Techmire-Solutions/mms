import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type Invoice, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { saveEnrollment } from "../../db/repositories/enrollmentRepositoryPersist.js";
import { findEnrollmentsByIds } from "../../db/repositories/enrollmentRepositoryHydrate.js";
import { bulkSaveInvoices } from "../../db/repositories/financeInvoicesRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { enrollmentOperationsUseCases as ops } from "../../enrollments/use-cases/enrollmentOperationsUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enrollment-ops-test";
const admin: User = {
  id: "u-admin",
  email: "admin@example.test",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: TENANT,
};
const today = todayInTimeZone(null);

async function enrollmentIdOf(studentId: string): Promise<string> {
  const result = await withTenant(TENANT, (tx) =>
    tx.execute<{ id: string }>(sql`
      SELECT id FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId}`),
  );
  return result.rows[0].id;
}

async function placementsOf(enrollmentId: string) {
  return withTenant(TENANT, async (tx) => {
    const result = await tx.execute<{
      classId: string;
      sectionId: string | null;
      startOn: string;
      endOn: string | null;
    }>(sql`
      SELECT class_id AS "classId", section_id AS "sectionId", start_on::text AS "startOn", end_on::text AS "endOn"
        FROM enrollment_placements
       WHERE workspace_subdomain = ${TENANT} AND enrollment_id = ${enrollmentId}
       ORDER BY start_on`);
    return result.rows;
  });
}

async function enrolledIn(classId: string): Promise<number | undefined> {
  const session = await findSessionById(TENANT, "ses-ops");
  return session?.classes?.find((cls) => cls.id === classId)?.enrolled;
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Ops test", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
        discountType: id === "s1" ? "sibling" : null,
      })),
    );
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "ses-ops",
      name: "Ops session",
      status: "in_progress",
      baseFee: 1000,
      classes: [
        { id: "cls-a", name: "Class A", sections: [{ id: "sec-a1", name: "A1", capacity: 5 }] },
        {
          id: "cls-b",
          name: "Class B",
          sections: [{ id: "sec-b1", name: "B1", capacity: 1 }],
          discounts: [{ id: "d-sib", discountType: "sibling", percentage: 50 }],
        },
      ],
    }),
  );
  await runWithTenant(TENANT, () =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1", "s2"],
      sessionId: "ses-ops",
      classId: "cls-a",
      mode: "add",
    }),
  );
  // Back-date the enrollments so a transfer today closes a real history row.
  await withTenant(TENANT, async (tx) => {
    await tx.execute(
      sql`UPDATE enrollment_placements SET start_on = '2026-01-01' WHERE workspace_subdomain = ${TENANT}`,
    );
    await tx.execute(
      sql`UPDATE enrollments SET enrolled_date = '2026-01-01' WHERE workspace_subdomain = ${TENANT}`,
    );
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("mid-session enrollment operations (real Postgres)", () => {
  it("given a transfer, should close the old placement, open the new one and move the seat", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");

    // Act
    const moved = await runWithTenant(TENANT, () =>
      ops.transfer(
        TENANT,
        id,
        { classId: "cls-b", effectiveOn: today, reason: "Moved to evening batch" },
        admin,
      ),
    );

    // Assert
    expect(moved).toMatchObject({
      classId: "cls-b",
      className: "Class B",
      sectionId: "sec-b1",
      discountType: "sibling",
      discountPct: 50,
      finalFee: 500,
    });
    expect(moved.timeline.at(-1)).toMatchObject({
      eventType: "transferred",
      fromClassId: "cls-a",
      toClassId: "cls-b",
      effectiveOn: today,
      reason: "Moved to evening batch",
    });
    const history = await placementsOf(id);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ classId: "cls-a", startOn: "2026-01-01" });
    expect(history[0].endOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(history[1]).toEqual({
      classId: "cls-b",
      sectionId: "sec-b1",
      startOn: today,
      endOn: null,
    });
    expect(await enrolledIn("cls-a")).toBe(1);
    expect(await enrolledIn("cls-b")).toBe(1);
  });

  it("given a full target section, should refuse the transfer with a conflict", async () => {
    // Arrange
    const id = await enrollmentIdOf("s2");

    // Act
    const attempt = runWithTenant(TENANT, () =>
      ops.transfer(TENANT, id, { classId: "cls-b", effectiveOn: today, reason: "Wants B" }, admin),
    );

    // Assert
    await expect(attempt).rejects.toMatchObject({ statusCode: 409 });
  });

  it("given a withdrawal, should end the window, release the seat and settle later invoices", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");
    const period = (offset: number) => {
      const [y, m] = today.split("-").map(Number);
      const day = new Date(Date.UTC(y, m - 1 + offset, 1));
      return day.toISOString().slice(0, 7);
    };
    const invoice = (suffix: string, billingPeriod: string, extra: Partial<Invoice> = {}) => ({
      id: `inv-ops-${suffix}`,
      studentId: "s1",
      studentName: "",
      class: "Class B",
      session: "Ops session",
      baseFee: 1000,
      discountValue: 0,
      discountAmt: 0,
      finalAmt: 500,
      status: "pending" as const,
      dueDate: `${billingPeriod}-10`,
      paidAmt: 0,
      invoiceNumber: `OPS-${suffix}`,
      billingPeriod,
      enrollmentId: id,
      ...extra,
    });
    await bulkSaveInvoices(TENANT, [
      invoice("now", period(0)),
      invoice("next", period(1)),
      invoice("paid", period(2), { status: "paid", paidAmt: 500 }),
    ]);

    // Act
    const { enrollment: withdrawn, billing } = await runWithTenant(TENANT, () =>
      ops.withdraw(TENANT, id, { effectiveOn: today, reason: "Family moved away" }, admin),
    );

    // Assert
    expect(billing).toEqual({
      cancelled: [{ id: "inv-ops-next", invoiceNumber: "OPS-next" }],
      review: [{ id: "inv-ops-paid", invoiceNumber: "OPS-paid" }],
    });
    const statuses = await withTenant(TENANT, (tx) =>
      tx.execute<{ id: string; status: string }>(sql`
        SELECT id, status FROM finance_invoices WHERE workspace_subdomain = ${TENANT} ORDER BY id`),
    );
    expect(Object.fromEntries(statuses.rows.map((row) => [row.id, row.status]))).toEqual({
      "inv-ops-next": "cancelled",
      "inv-ops-now": "pending",
      "inv-ops-paid": "paid",
    });
    expect(withdrawn).toMatchObject({
      status: "withdrawn",
      endOn: today,
      endReason: "Family moved away",
    });
    expect((await placementsOf(id)).every((row) => row.endOn !== null)).toBe(true);
    expect(await enrolledIn("cls-b")).toBe(0);
  });

  it("given a generic save that resends the timeline, should keep server events and append new ones", async () => {
    // Arrange
    const id = await enrollmentIdOf("s1");
    const current = (await runWithTenant(TENANT, () => ops.placements(TENANT, id))).length;
    const before = await withTenant(TENANT, (tx) =>
      tx.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM enrollment_timeline_events WHERE workspace_subdomain = ${TENANT} AND enrollment_id = ${id}`),
    );
    const [record] = await findEnrollmentsByIds(TENANT, [id]);

    // Act
    await saveEnrollment(TENANT, {
      ...record,
      timeline: [...record.timeline, { ts: new Date().toISOString(), event: "Note", by: "Admin" }],
    });

    // Assert
    const after = await withTenant(TENANT, (tx) =>
      tx.execute<{ count: number; typed: number }>(sql`
        SELECT count(*)::int AS count, count(event_type)::int AS typed
          FROM enrollment_timeline_events WHERE workspace_subdomain = ${TENANT} AND enrollment_id = ${id}`),
    );
    expect(after.rows[0].count).toBe(before.rows[0].count + 1);
    expect(after.rows[0].typed).toBe(2);
    expect((await runWithTenant(TENANT, () => ops.placements(TENANT, id))).length).toBe(current);
  });
});
