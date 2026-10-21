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
import { requireDbDate } from "../../lib/dbDate.js";
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
  // `mms_try_date` existed only to parse the varchar date columns; migration 0182 drops both, so
  // this case asserts the helper only on a database that still has it (between 0172 and 0182).
  it("given raw text, should parse dates, date-times and reject junk via mms_try_date", async () => {
    // Arrange
    const present = await withTenant(TENANT, (tx) =>
      tx.execute<{ ok: boolean }>(
        sql`SELECT to_regprocedure('mms_try_date(text)') IS NOT NULL AS ok`,
      ),
    );
    if (!present.rows[0]?.ok) return;

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

  it("given release A (0181), should sync the new date columns and the legacy varchars both ways", async () => {
    // Arrange: the current release writes `registered_on`; the previous one writes the varchar.
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
      withTenant(
        TENANT,
        async (tx) =>
          (
            await tx.execute<{ on: string | null; legacy: string | null }>(sql`
            SELECT registered_on::text AS "on", registered_date AS legacy FROM students
             WHERE workspace_subdomain = ${TENANT} AND id = 'dt-stu'`)
          ).rows[0],
      );
    const fromNew = await read();

    // Act
    await withTenant(TENANT, (tx) =>
      tx.execute(sql`UPDATE students SET registered_date = '2025-10-02T08:00:00Z'
        WHERE workspace_subdomain = ${TENANT} AND id = 'dt-stu'`),
    );
    const fromLegacy = await read();

    // Assert
    expect(fromNew).toEqual({ on: "2025-09-01", legacy: "2025-09-01" });
    expect(fromLegacy).toEqual({ on: "2025-10-02", legacy: "2025-10-02T08:00:00Z" });
  });

  it("given a non-date value on write, should reject it instead of storing NULL", () => {
    // Act / Assert
    expect(() => requireDbDate("15/03/2024", "Registered date")).toThrow(/YYYY-MM-DD/);
    expect(requireDbDate("", "Registered date")).toBeNull();
    expect(requireDbDate("2024-03-15T09:00:00Z", "Registered date")).toBe("2024-03-15");
  });
});
