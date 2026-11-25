import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/contracts";
import { closeDatabase } from "@mms/db/client";
import { applyDrizzleMigrations } from "@mms/db/migrations";
import { withTenant } from "@mms/db/context";
import { sessionClassTimetables, students, workspaces } from "@mms/db/schema";
import { saveSession } from "../../repository/db/sessionRepositoryPersist.js";
import { bulkEnrollStudentsIntoClass } from "../../deps.js";
import { loadSessionsReportAggregatesSql } from "../../repository/db/sessionRepositoryReport.js";
import { todayInTimeZone } from "@mms/be-core/http";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "sessions-report-test";
const TIMEZONE = "Pacific/Kiritimati";
const today = todayInTimeZone(TIMEZONE);

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Reports",
      enabled: true,
      timezone: TIMEZONE,
    });
    await tx.insert(students).values({ id: "s1", workspaceSubdomain: TENANT, grNumber: "gr-1" });
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "course",
      name: "Report Course",
      status: "in_progress",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      classes: [{ id: "class-a", name: "Class A", room: "Room 1", maxStudents: 10 }],
    }),
  );
  await bulkEnrollStudentsIntoClass(TENANT, {
    studentIds: ["s1"],
    sessionId: "course",
    classId: "class-a",
    mode: "add",
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(sessionClassTimetables).values({
      id: "tt-canonical",
      workspaceSubdomain: TENANT,
      sessionClassId: "class-a",
      date: today,
    });
    await tx.execute(sql`
      INSERT INTO session_class_timetable_periods
        (id, workspace_subdomain, timetable_id, start_time, end_time, subject_id, faculty_id, faculty_name)
      VALUES ('p-canonical', ${TENANT}, 'tt-canonical', '09:00', '10:00', NULL, NULL, 'Ustadh')
    `);
    // A stale legacy row must not drive the report after canonical timetables replaced it.
    await tx.execute(sql`
      INSERT INTO session_timetable (id, workspace_subdomain, session_id, day, activity, start_time, end_time, location, type, sort_order)
      VALUES ('legacy', ${TENANT}, 'course', 'Mon', 'Legacy', '23:00', '23:30', 'Room 1', 'class', 0)
    `);
    await tx.execute(sql`
      UPDATE enrollments SET completion_status = 'completed'
      WHERE workspace_subdomain = ${TENANT} AND session_id = 'course' AND student_id = 's1'
    `);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("sessions report aggregates", () => {
  it("uses canonical timetables and the workspace day for today's classes", async () => {
    const aggregates = await loadSessionsReportAggregatesSql(TENANT);
    expect(aggregates.todaysSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Report Course – Class A",
          teacher: "Ustadh",
          time: "09:00 - 10:00",
          room: "Room 1",
        }),
      ]),
    );
    expect(JSON.stringify(aggregates.todaysSessions)).not.toContain("23:00");
  });

  it("reports seat balance and completion rates", async () => {
    const aggregates = await loadSessionsReportAggregatesSql(TENANT);
    expect(aggregates.capacity[0]).toMatchObject({
      sessionId: "course",
      classId: "class-a",
      enrolled: 1,
      capacity: 10,
      freeSeats: 9,
      rate: 10,
    });
    expect(aggregates.completion).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "course",
          completed: 1,
          notCompleted: 0,
          rate: 100,
        }),
      ]),
    );
  });

  it("excludes completed sessions unless includeCompleted is requested", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.execute(
        sql`UPDATE sessions SET status = 'completed' WHERE workspace_subdomain = ${TENANT} AND id = 'course'`,
      );
    });
    expect((await loadSessionsReportAggregatesSql(TENANT)).capacity).toHaveLength(0);
    const historical = await loadSessionsReportAggregatesSql(TENANT, { includeCompleted: true });
    expect(historical.capacity).toHaveLength(1);
  });
});
