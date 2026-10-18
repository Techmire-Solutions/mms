import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { sessions, students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { createSessionsUseCases } from "../../sessions/use-cases/sessionsUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "date-columns-test";

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
  await withTenant(TENANT, (tx) =>
    tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Dates test", enabled: true }),
  );
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("academic date columns (real Postgres)", () => {
  it("given raw text, should parse dates, date-times and reject junk via mms_try_date", async () => {
    // Act
    const result = await withTenant(TENANT, (tx) =>
      tx.execute<{ a: string | null; b: string | null; c: string | null; d: string | null }>(sql`
      SELECT mms_try_date('2026-03-02')::text AS a, mms_try_date(' 2026-03-02T10:00:00Z ')::text AS b,
             mms_try_date('2026-02-31')::text AS c, mms_try_date('')::text AS d`),
    );

    // Assert
    expect(result.rows[0]).toEqual({ a: "2026-03-02", b: "2026-03-02", c: null, d: null });
  });

  it("given a session with an empty end date and nested child dates, should store NULL and read back empty strings", async () => {
    // Act
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "dt-ses",
        name: "Dates",
        startDate: "2026-01-10",
        endDate: "",
        classes: [
          {
            id: "dt-cls",
            name: "Class",
            ageCalculationDate: "",
            timetables: [{ id: "tt", classId: "dt-cls", date: "2026-01-12", periods: [] }],
          },
        ],
      }),
    );
    const stored = await withTenant(TENANT, (tx) =>
      tx
        .select({ startDate: sessions.startDate, endDate: sessions.endDate })
        .from(sessions)
        .where(eq(sessions.id, "dt-ses")),
    );
    const read = await findSessionById(TENANT, "dt-ses");

    // Assert
    expect(stored[0]).toEqual({ startDate: "2026-01-10", endDate: null });
    expect(read).toMatchObject({ startDate: "2026-01-10", endDate: "" });
    expect(read?.classes[0]).toMatchObject({ ageCalculationDate: "" });
    expect(read?.classes[0].timetables?.[0]).toMatchObject({ date: "2026-01-12" });
  });

  it("given an end date before the start date, should reject the update with 400", async () => {
    // Arrange
    const cases = createSessionsUseCases();

    // Act
    const update = runWithTenant(TENANT, () =>
      cases.updateSessionById("dt-ses", { endDate: "2025-12-01" }),
    );

    // Assert
    await expect(update).rejects.toMatchObject({ statusCode: 400 });
  });

  it("given writes to large tables, should keep the 0173 date copies in sync and let backfills preserve updated_at", async () => {
    // Arrange
    await withTenant(TENANT, (tx) =>
      tx.insert(students).values({
        id: "dt-stu",
        workspaceSubdomain: TENANT,
        grNumber: "gr-dt",
        status: "active",
        registeredDate: "2025-09-01",
      }),
    );
    const read = () =>
      withTenant(TENANT, (tx) =>
        tx
          .select({
            registeredOn: students.registeredOn,
            enrollmentOn: students.enrollmentOn,
            updatedAt: students.updatedAt,
          })
          .from(students)
          .where(eq(students.id, "dt-stu")),
      );
    const [inserted] = await read();

    // Act
    await withTenant(TENANT, (tx) =>
      tx
        .update(students)
        .set({ enrollmentDate: "2025-09-15T08:00:00Z" })
        .where(eq(students.id, "dt-stu")),
    );
    const [synced] = await read();
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SELECT set_config('app.preserve_updated_at', 'on', true)`);
      await tx.update(students).set({ registeredOn: null }).where(eq(students.id, "dt-stu"));
    });
    const [preserved] = await read();

    // Assert
    expect(inserted.registeredOn).toBe("2025-09-01");
    expect(synced).toMatchObject({ registeredOn: "2025-09-01", enrollmentOn: "2025-09-15" });
    expect(preserved.registeredOn).toBe("2025-09-01");
    expect(preserved.updatedAt.toISOString()).toBe(synced.updatedAt.toISOString());
  });
});
