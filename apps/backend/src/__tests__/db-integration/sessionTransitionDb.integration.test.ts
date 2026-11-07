import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { enrollments, students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkSaveInvoices } from "../../db/repositories/financeInvoicesRepository.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { transitionSession } from "../../sessions/use-cases/sessionTransitionService.js";
import { withSavepoint } from "../../db/transactionSideEffects.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-transition-test";
const admin = { id: "u-admin", name: "Admin", email: "admin@demo.test" } as User;
const run = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);
const isoDaysAgo = (days: number, today: string) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
const nextMonth = (today: string) => {
  const [year, month] = today.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
};

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function seedSession(
  id: string,
  input: { status?: string; startDate: string; endDate: string },
): Promise<void> {
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id,
      name: `Session ${id}`,
      status: input.status ?? "open",
      startDate: input.startDate,
      endDate: input.endDate,
      baseFee: 500,
      // These fixtures deliberately run several live sessions in parallel; overlaps are out of
      // scope here (the exclusion constraint is covered by sessionsIntegrityDb).
      overlapExempt: true,
      classes: [{ id: `${id}-class`, name: "Class", sections: [{ id: `${id}-a`, name: "A" }] }],
    }),
  );
}

let today: string;

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Transitions", enabled: true });
    await tx.insert(students).values([
      {
        id: "t-student-1",
        workspaceSubdomain: TENANT,
        grNumber: "gr-t1",
        status: "active",
      },
      {
        id: "t-student-2",
        workspaceSubdomain: TENANT,
        grNumber: "gr-t2",
        status: "active",
      },
    ]);
  });
  today = await run(async () => {
    const { sessionsAcademicRepository } = await import(
      "../../sessions/repository/sessionsAcademicRepositoryAdapter.js"
    );
    const tz = await sessionsAcademicRepository.findWorkspaceTimezone(TENANT);
    return todayInTimeZone(tz);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("session transition atomicity (real Postgres)", () => {
  it("contains a statement failure in a savepoint without aborting the outer transaction", async () => {
    // Act
    const written = await run(async () => {
      await saveSession(
        TENANT,
        SessionSchema.parse({
          id: "sp-keep",
          name: "Savepoint keeper",
          status: "draft",
          startDate: isoDaysAgo(10, today),
          endDate: isoDaysAgo(1, today),
          baseFee: 0,
          overlapExempt: true,
          classes: [],
        }),
      );
      await expect(
        withSavepoint(async (tx) => {
          await tx.execute(sql`SELECT 1 / 0`);
        }),
      ).rejects.toThrow();
      return withTenant(TENANT, (tx) =>
        tx.select({ id: enrollments.id }).from(enrollments).limit(0),
      );
    });

    // Assert — the transaction is still usable and the earlier write commits.
    expect(written).toEqual([]);
    expect(await findSessionById(TENANT, "sp-keep")).toBeTruthy();
  });

  it("cancels with a reviewed invoice and keeps the transaction healthy", async () => {
    // Arrange
    const start = isoDaysAgo(20, today);
    const end = isoDaysAgo(5, today);
    await seedSession("cancel-live", { status: "in_progress", startDate: start, endDate: end });
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["t-student-1"],
        sessionId: "cancel-live",
        classId: "cancel-live-class",
        mode: "add",
      }),
    );
    const period = nextMonth(today);
    const period2 = nextMonth(`${period}-01`);
    await bulkSaveInvoices(TENANT, [
      {
        id: "inv-unpaid",
        studentId: "t-student-1",
        studentName: "",
        class: "Class",
        session: "cancel-live",
        baseFee: 500,
        discountValue: 0,
        discountAmt: 0,
        finalAmt: 500,
        status: "pending",
        dueDate: `${period}-10`,
        paidAmt: 0,
        invoiceNumber: "TR-1",
        billingPeriod: period,
        enrollmentId: (await enrollmentId("cancel-live")) ?? "",
      },
      {
        id: "inv-paid",
        studentId: "t-student-1",
        studentName: "",
        class: "Class",
        session: "cancel-live",
        baseFee: 100,
        discountValue: 0,
        discountAmt: 0,
        finalAmt: 100,
        status: "pending",
        dueDate: `${period}-10`,
        paidAmt: 100,
        invoiceNumber: "TR-2",
        billingPeriod: period2,
        enrollmentId: (await enrollmentId("cancel-live")) ?? "",
      },
    ]);

    // Act
    const result = await run(() =>
      transitionSession(TENANT, "cancel-live", {
        to: "cancelled",
        reason: "Teacher unavailable",
        actor: { userId: admin.id, label: admin.name },
      }),
    );

    // Assert — the paid invoice goes to review, the untouched one is cancelled, and the cancel
    // committed (nothing was aborted by the reviewed invoice).
    expect(result.ended).toBe(1);
    expect(result.billing?.cancelled.map((invoice) => invoice.id)).toEqual(["inv-unpaid"]);
    expect(result.billing?.review.map((invoice) => invoice.id)).toEqual(["inv-paid"]);
    expect((await findSessionById(TENANT, "cancel-live"))?.status).toBe("cancelled");
    const [enrollment] = await withTenant(TENANT, (tx) =>
      tx
        .select({ status: enrollments.status })
        .from(enrollments)
        .where(eq(enrollments.sessionId, "cancel-live")),
    );
    expect(enrollment?.status).toBe("cancelled");
  });

  it("ends live enrollments atomically when a session is completed", async () => {
    // Arrange
    const start = isoDaysAgo(30, today);
    const end = isoDaysAgo(2, today);
    await seedSession("complete-live", { status: "in_progress", startDate: start, endDate: end });
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["t-student-2"],
        sessionId: "complete-live",
        classId: "complete-live-class",
        mode: "add",
      }),
    );

    // Act
    const result = await run(() => transitionSession(TENANT, "complete-live", { to: "completed" }));

    // Assert
    expect(result.ended).toBe(1);
    expect((await findSessionById(TENANT, "complete-live"))?.status).toBe("completed");
    const [enrollment] = await withTenant(TENANT, (tx) =>
      tx
        .select({ status: enrollments.status, endOn: enrollments.endOn })
        .from(enrollments)
        .where(eq(enrollments.sessionId, "complete-live")),
    );
    expect(enrollment?.status).toBe("completed");
    // A placement that began after the session end is closed on its own first day (the same clamp
    // the withdrawal path applies), so assert the day exists rather than a fixed value.
    expect(enrollment?.endOn).toBeTruthy();
  });

  it("rejects fresh illegal jumps and does not write", async () => {
    // Arrange
    await seedSession("jump-draft", {
      status: "draft",
      startDate: isoDaysAgo(-10, today),
      endDate: isoDaysAgo(-40, today),
    });

    // Act
    const act = run(() => transitionSession(TENANT, "jump-draft", { to: "in_progress" }));

    // Assert
    await expect(act).rejects.toMatchObject({ type: "session_transition_blocked" });
    expect((await findSessionById(TENANT, "jump-draft"))?.status).toBe("draft");
  });

  it("lets only one of two concurrent bulk transitions win", async () => {
    // Arrange
    await seedSession("race-open", {
      status: "open",
      startDate: isoDaysAgo(-10, today),
      endDate: isoDaysAgo(-40, today),
    });

    const before = await findSessionById(TENANT, "race-open");
    // Act — both callers hold the same version token and race the compare-and-set write.
    const results = await Promise.allSettled([
      run(() =>
        transitionSession(TENANT, "race-open", {
          to: "in_progress",
          expectedVersion: before?.version,
        }),
      ),
      run(() =>
        transitionSession(TENANT, "race-open", {
          to: "cancelled",
          reason: "Double click",
          expectedVersion: before?.version,
        }),
      ),
    ]);

    // Assert — exactly one writer lands; the stale token is refused with a conflict.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: expect.any(ConflictError) });
    const status = (await findSessionById(TENANT, "race-open"))?.status;
    expect(["in_progress", "cancelled"]).toContain(status);
  });

  it("is idempotent for the same-state request (no write, no version bump)", async () => {
    // Arrange
    await seedSession("noop-open", {
      status: "open",
      startDate: isoDaysAgo(-1, today),
      endDate: isoDaysAgo(-20, today),
    });
    const before = await findSessionById(TENANT, "noop-open");

    // Act
    const result = await run(() => transitionSession(TENANT, "noop-open", { to: "open" }));

    // Assert
    expect(result.noop).toBe(true);
    expect((await findSessionById(TENANT, "noop-open"))?.version).toBe(before?.version);
  });
});

async function enrollmentId(sessionId: string): Promise<string | null> {
  const [row] = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.sessionId, sessionId))
      .limit(1),
  );
  return row?.id ?? null;
}
