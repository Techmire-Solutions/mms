import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { SessionSchema, type Session } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  workspaces,
  students,
  sessionClasses,
  sessionClassFees,
  sessionClassTimetablePeriods,
  enrollments,
} from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "ses-class-persist-test";
const SESSION_ID = "ses-persist-1";

function buildSession(classNames: Array<"A" | "B">, nameSuffix = ""): Session {
  return SessionSchema.parse({
    id: SESSION_ID,
    name: "Persist Session",
    status: "upcoming",
    classes: classNames.map((key) => ({
      id: `cls-${key}`,
      name: `Class ${key}${nameSuffix}`,
      maxStudents: 20,
      fees: [{ id: `fee-${key}`, feeType: "monthly", amount: 500 }],
      timetables: [
        {
          id: `tt-${key}`,
          date: "2026-01-05",
          periods: [{ id: `per-${key}`, startTime: "08:00", endTime: "09:00", subject: "Fiqh" }],
        },
      ],
    })),
  });
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Class persist test", enabled: true });
    await tx.insert(students).values({
      id: "stu-1",
      workspaceSubdomain: TENANT,
      grNumber: "gr-persist-1",
      status: "active",
    });
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("persistSessionClassesTx (real Postgres)", () => {
  it("given a saved session, should update classes in place, derive enrolled, and block removing enrolled classes when re-saved", async () => {
    // Arrange
    await saveSession(TENANT, buildSession(["A", "B"]));
    const [before] = await withTenant(TENANT, (tx) =>
      tx
        .select({ createdAt: sessionClasses.createdAt })
        .from(sessionClasses)
        .where(and(eq(sessionClasses.workspaceSubdomain, TENANT), eq(sessionClasses.id, "cls-A"))),
    );

    // Act: re-save with edits (class rows must be updated in place, not deleted and re-inserted)
    await saveSession(TENANT, buildSession(["A", "B"], " (edited)"));
    const [after] = await withTenant(TENANT, (tx) =>
      tx
        .select({ createdAt: sessionClasses.createdAt, name: sessionClasses.name })
        .from(sessionClasses)
        .where(and(eq(sessionClasses.workspaceSubdomain, TENANT), eq(sessionClasses.id, "cls-A"))),
    );

    // Assert
    expect(after.name).toBe("Class A (edited)");
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());

    await withTenant(TENANT, (tx) =>
      tx.insert(enrollments).values({
        id: "enr-1",
        workspaceSubdomain: TENANT,
        studentId: "stu-1",
        sessionId: SESSION_ID,
        classId: "cls-A",
        enrolledDate: "2026-01-01",
        status: "confirmed",
      }),
    );
    const hydrated = await withTenant(TENANT, () => findSessionById(TENANT, SESSION_ID));
    expect(hydrated?.status).toBe("open");
    const byId = new Map((hydrated?.classes ?? []).map((c) => [c.id, c]));
    expect(byId.get("cls-A")?.enrolled).toBe(1);
    expect(byId.get("cls-B")?.enrolled).toBe(0);
    expect(byId.get("cls-A")?.fees).toHaveLength(1);
    expect(byId.get("cls-A")?.timetables[0]?.periods).toHaveLength(1);

    await expect(saveSession(TENANT, buildSession(["B"]))).rejects.toMatchObject({
      statusCode: 409,
    });

    await saveSession(TENANT, buildSession(["A"]));
    const remaining = await withTenant(TENANT, async (tx) => ({
      classes: await tx
        .select({ id: sessionClasses.id })
        .from(sessionClasses)
        .where(eq(sessionClasses.workspaceSubdomain, TENANT)),
      fees: await tx
        .select({ id: sessionClassFees.id })
        .from(sessionClassFees)
        .where(eq(sessionClassFees.workspaceSubdomain, TENANT)),
      periods: await tx
        .select({ id: sessionClassTimetablePeriods.id })
        .from(sessionClassTimetablePeriods)
        .where(eq(sessionClassTimetablePeriods.workspaceSubdomain, TENANT)),
    }));
    expect(remaining.classes.map((c) => c.id)).toEqual(["cls-A"]);
    expect(remaining.fees.map((f) => f.id)).toEqual(["fee-A"]);
    expect(remaining.periods.map((p) => p.id)).toEqual(["per-A"]);
  });

  it("lets only one concurrent class save win the OCC race and does not duplicate children", async () => {
    const base = SessionSchema.parse({
      id: "race-class-session",
      name: "Race class persistence",
      status: "draft",
      startDate: "2040-01-01",
      endDate: "2040-12-31",
      overlapExempt: true,
      classes: [
        {
          id: "race-class",
          name: "Race",
          fees: [{ id: "race-fee", feeType: "monthly", amount: 100 }],
        },
      ],
    });
    await saveSession(TENANT, base);
    const before = await findSessionById(TENANT, "race-class-session");
    const results = await Promise.allSettled([
      saveSession(TENANT, { ...base, name: "Winner A" }, { expectedVersion: before?.version }),
      saveSession(TENANT, { ...base, name: "Winner B" }, { expectedVersion: before?.version }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const after = await findSessionById(TENANT, "race-class-session");
    expect(after?.version).toBe(Number(before?.version) + 1);
    const childCounts = await withTenant(TENANT, async (tx) => ({
      classes: await tx
        .select({ id: sessionClasses.id })
        .from(sessionClasses)
        .where(eq(sessionClasses.sessionId, "race-class-session")),
      fees: await tx
        .select({ id: sessionClassFees.id })
        .from(sessionClassFees)
        .where(eq(sessionClassFees.workspaceSubdomain, TENANT)),
    }));
    expect(childCounts.classes.map((row) => row.id)).toEqual(["race-class"]);
    expect(childCounts.fees.filter((row) => row.id.startsWith("race-fee"))).toHaveLength(1);
  });

  it("removes all class children when a session is re-saved with no classes", async () => {
    const emptyId = "empty-class-session";
    const base = SessionSchema.parse({
      id: emptyId,
      name: "Empty classes",
      status: "draft",
      startDate: "2041-01-01",
      endDate: "2041-12-31",
      overlapExempt: true,
      classes: [
        {
          id: "empty-class",
          name: "Empty",
          fees: [{ id: "empty-fee", feeType: "monthly", amount: 10 }],
          timetables: [
            {
              id: "empty-tt",
              date: "2041-01-01",
              periods: [
                { id: "empty-period", startTime: "08:00", endTime: "09:00", subject: "Fiqh" },
              ],
            },
          ],
        },
      ],
    });
    await saveSession(TENANT, base);
    await saveSession(TENANT, { ...base, classes: [] });
    const remaining = await withTenant(TENANT, async (tx) => ({
      classes: await tx
        .select({ id: sessionClasses.id })
        .from(sessionClasses)
        .where(eq(sessionClasses.sessionId, emptyId)),
      fees: await tx
        .select({ id: sessionClassFees.id })
        .from(sessionClassFees)
        .where(inArray(sessionClassFees.id, ["empty-fee"])),
      periods: await tx
        .select({ id: sessionClassTimetablePeriods.id })
        .from(sessionClassTimetablePeriods)
        .where(inArray(sessionClassTimetablePeriods.id, ["empty-period"])),
    }));
    expect(remaining.classes).toEqual([]);
    expect(remaining.fees).toEqual([]);
    expect(remaining.periods).toEqual([]);
  });
});
