import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  attendance,
  attendanceLeaves,
  attendanceModulePreferences,
  students,
  workspaces,
} from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { saveAcademicCalendarEvent } from "../../db/repositories/academicCalendarRepository.js";
import { aggregateAttendanceCommandMetrics } from "../../db/repositories/attendanceRepositoryMetrics.js";
import { assertInstructionalDays } from "../../attendance/use-cases/instructionalDayGuard.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "academic-calendar-test";
const ACTOR = "user-1";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function mark(id: string, studentId: string, date: string, status: string) {
  return { id, workspaceSubdomain: TENANT, classId: "cal-cls", studentId, date, status };
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Calendar test", enabled: true });
    await tx.insert(attendanceModulePreferences).values({
      workspaceSubdomain: TENANT,
      preferences: { workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
    });
    await tx.insert(students).values(
      ["s1", "s2"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
  });
  await invalidateMultiTierCache({ tenantId: TENANT, domain: "attendance_module_preferences" });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "cal-ses",
      name: "Calendar Session",
      classes: [{ id: "cal-cls", name: "Class", discounts: [] }],
    }),
  );
  await saveAcademicCalendarEvent(TENANT, {
    id: "eid",
    title: "Eid",
    kind: "holiday",
    startOn: "2026-03-03",
    endOn: "2026-03-03",
    scope: "workspace",
    sessionId: null,
    classId: null,
    sectionId: null,
    notes: null,
    actorUserId: ACTOR,
  });
  await saveAcademicCalendarEvent(TENANT, {
    id: "makeup",
    title: "Make-up",
    kind: "makeup_day",
    startOn: "2026-03-07",
    endOn: "2026-03-07",
    scope: "class",
    sessionId: "cal-ses",
    classId: "cal-cls",
    sectionId: null,
    notes: null,
    actorUserId: ACTOR,
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(attendance).values([
      mark("a1", "s1", "2026-03-02", "present"), // Monday — counts
      mark("a2", "s1", "2026-03-03", "absent"), // Eid — excluded
      mark("a3", "s1", "2026-03-07", "absent"), // make-up Saturday — counts
      mark("a4", "s1", "2026-03-08", "absent"), // Sunday off-day — excluded
      mark("a5", "s2", "2026-03-04", "absent"), // approved leave — excluded
    ]);
    await tx.insert(attendanceLeaves).values({
      id: "lv1",
      workspaceSubdomain: TENANT,
      studentId: "s2",
      fromDate: "2026-03-04",
      toDate: "2026-03-05",
      reason: "Ill",
      status: "approved",
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

describe("academic calendar (real Postgres)", () => {
  it("given a workspace holiday or a weekly off-day, should block marking with 409 non_instructional_day", async () => {
    // Act
    const onHoliday = assertInstructionalDays(
      TENANT,
      [{ classId: "cal-cls", studentId: "s1", date: "2026-03-03" }],
      ACTOR,
    );
    const onSunday = assertInstructionalDays(
      TENANT,
      [{ classId: "cal-cls", studentId: "s1", date: "2026-03-08" }],
      ACTOR,
    );
    const onMakeup = assertInstructionalDays(
      TENANT,
      [{ classId: "cal-cls", studentId: "s1", date: "2026-03-07" }],
      ACTOR,
    );

    // Assert
    await expect(onHoliday).rejects.toMatchObject({
      statusCode: 409,
      type: "non_instructional_day",
      message: expect.stringContaining("Eid"),
    });
    await expect(onSunday).rejects.toMatchObject({
      statusCode: 409,
      type: "non_instructional_day",
    });
    await expect(onMakeup).resolves.toBeUndefined();
  });

  it("given holiday, off-day and leave rows, should exclude them from attendance rates", async () => {
    // Act
    const metrics = await aggregateAttendanceCommandMetrics(TENANT, { selectedDate: "2026-03-02" });

    // Assert — counted rows: a1 present, a3 absent → 50%.
    expect(metrics.total).toBe(5);
    expect(metrics.overallPresentRate).toBe(50);
    expect(metrics.selectedDatePresentRate).toBe(100);
  });

  it("given a session working-days override, should persist and hydrate it and let weekend sessions mark Sundays", async () => {
    // Arrange
    const session = await findSessionById(TENANT, "cal-ses");
    await saveSession(
      TENANT,
      SessionSchema.parse({ ...session, workingDays: ["saturday", "sunday"] }),
    );

    // Act
    const hydrated = await findSessionById(TENANT, "cal-ses");
    const onSunday = assertInstructionalDays(
      TENANT,
      [{ classId: "cal-cls", studentId: "s1", date: "2026-03-08" }],
      ACTOR,
    );

    // Assert
    expect(hydrated?.workingDays).toEqual(["sunday", "saturday"]);
    await expect(onSunday).resolves.toBeUndefined();
  });
});
