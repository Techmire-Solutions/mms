import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { attendance, students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import {
  listFeeStructures,
  saveFeeStructure,
} from "../../db/repositories/financeBillingRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { attendanceUseCases } from "../../attendance/use-cases/attendanceUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "class-integrity-test";

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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Integrity test", enabled: true });
    await tx
      .insert(students)
      .values({ id: "s1", workspaceSubdomain: TENANT, grNumber: "gr-s1", status: "active" });
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "ci-ses",
      name: "Integrity Session",
      baseFee: 500,
      classes: [
        { id: "ci-cls", name: "Darja 1", discounts: [] },
        { id: "ci-spare", name: "Darja 2", discounts: [] },
      ],
    }),
  );
  await runWithTenant(TENANT, () =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1"],
      sessionId: "ci-ses",
      classId: "ci-cls",
      mode: "add",
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

describe("class / section reference integrity (real Postgres)", () => {
  it("given attendance for an enrolled student, should stamp the section of record and ignore the client value", async () => {
    // Act
    const [saved] = await runWithTenant(TENANT, () =>
      attendanceUseCases.upsertAttendanceRecords([
        {
          id: "att-1",
          classId: "ci-cls",
          studentId: "s1",
          studentName: "S1",
          rollNo: "",
          date: "2026-03-02",
          status: "present",
          timeIn: "",
          timeOut: "",
          notes: "",
          sectionId: "forged",
        },
      ]),
    );
    const session = await findSessionById(TENANT, "ci-ses");

    // Assert
    const sectionA = session?.classes.find((cls) => cls.id === "ci-cls")?.sections?.[0]?.id;
    expect(sectionA).toEqual(expect.any(String));
    expect(saved.sectionId).toBe(sectionA);
  });

  it("given a bogus class id, should reject the attendance row at the database", async () => {
    // Act
    const insert = withTenant(TENANT, (tx) =>
      tx.insert(attendance).values({
        id: "att-bad",
        workspaceSubdomain: TENANT,
        classId: "no-such-class",
        studentId: "s1",
        date: "2026-03-03",
      }),
    );

    // Assert
    await expect(insert).rejects.toThrow();
  });

  it("given a fee structure with a class id, should derive session, program and snapshots server-side", async () => {
    // Act
    await saveFeeStructure(TENANT, {
      id: "fs-1",
      name: "Monthly",
      session: "stale",
      className: "stale",
      classId: "ci-spare",
      frequency: "monthly",
      isActive: true,
      items: [],
    });
    const [structure] = await listFeeStructures(TENANT);

    // Assert
    expect(structure).toMatchObject({
      classId: "ci-spare",
      className: "Darja 2",
      sessionId: "ci-ses",
      session: "Integrity Session",
    });
  });

  it("given archived attendance or a fee structure on a class, should block removing that class with 409", async () => {
    // Arrange
    await withTenant(TENANT, (tx) =>
      tx.update(attendance).set({ deletedAt: new Date() }).where(eq(attendance.id, "att-1")),
    );
    const session = await findSessionById(TENANT, "ci-ses");

    // Act
    const dropSpare = saveSession(
      TENANT,
      SessionSchema.parse({
        ...session,
        classes: session?.classes.filter((cls) => cls.id !== "ci-spare"),
      }),
    );

    // Assert
    await expect(dropSpare).rejects.toMatchObject({ statusCode: 409 });
  });
});
