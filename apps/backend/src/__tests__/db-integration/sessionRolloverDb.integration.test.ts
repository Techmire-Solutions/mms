import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, sessionRolloverBodySchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import {
  createPromotionRun,
  findPromotionRun,
} from "../../db/repositories/sessionPromotionRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { executeSessionRollover } from "../../sessions/use-cases/sessionRolloverJob.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-rollover-test";
const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
  withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);
const run = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);
const noProgress = async () => undefined;

const body = sessionRolloverBodySchema.parse({
  mode: "promote",
  target: { name: "Next Year", startDate: "2027-01-01", endDate: "2027-12-31" },
  copy: { staff: false, calendar: false },
  classMap: [
    { sourceClassId: "c1", nextClassId: "c2" },
    { sourceClassId: "c2", nextClassId: null },
  ],
  outcomes: [],
});

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function enrollmentIdOf(studentId: string): Promise<string> {
  const [row] = await query<{ id: string }>(sql`
    SELECT id FROM enrollments
     WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId} AND session_id = 'src'`);
  return String(row?.id);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Rollover", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2", "s3"].map((id) => ({
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
      id: "src",
      name: "This Year",
      status: "in_progress",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: 1000,
      classes: ["c1", "c2"].map((id) => ({
        id,
        name: id.toUpperCase(),
        sections: [{ id: `${id}-a`, name: "A", capacity: 10 }],
        fees: [{ id: `${id}-fee`, feeType: "monthly", amount: 300 }],
      })),
    }),
  );
  for (const [studentId, classId] of [
    ["s1", "c1"],
    ["s2", "c2"],
    ["s3", "c1"],
  ] as const) {
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: [studentId],
        sessionId: "src",
        classId,
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

describe("session rollover (real Postgres)", () => {
  it("given a promote run, should create a draft copy, carry students and close the source", async () => {
    // Arrange
    const retained = await enrollmentIdOf("s3");
    const payload = {
      runId: "run-1",
      sourceSessionId: "src",
      body: { ...body, outcomes: [{ enrollmentId: retained, outcome: "retain" as const }] },
    };
    await createPromotionRun(TENANT, {
      id: "run-1",
      sourceSessionId: "src",
      mode: "promote",
      classMap: body.classMap,
      createdBy: "u-admin",
    });

    // Act
    const result = await run(() => executeSessionRollover(TENANT, "u-admin", payload, noProgress));
    const again = await run(() => executeSessionRollover(TENANT, "u-admin", payload, noProgress));

    // Assert
    const target = await findSessionById(TENANT, result.targetSessionId);
    expect(again.targetSessionId).toBe(result.targetSessionId);
    expect(target).toMatchObject({ status: "draft", name: "Next Year", startDate: "2027-01-01" });
    expect(target?.classes.map((cls) => [cls.name, cls.fees.length])).toEqual([
      ["C1", 1],
      ["C2", 1],
    ]);
    const carried = await query<{ studentId: string; className: string; status: string }>(sql`
      SELECT e.student_id AS "studentId", c.name AS "className", e.status
        FROM enrollments e JOIN session_classes c
          ON c.workspace_subdomain = e.workspace_subdomain AND c.id = e.class_id
       WHERE e.workspace_subdomain = ${TENANT} AND e.session_id = ${result.targetSessionId}
         AND e.promoted_from_enrollment_id IS NOT NULL
       ORDER BY e.student_id`);
    expect(carried).toEqual([
      { studentId: "s1", className: "C2", status: "pending" },
      { studentId: "s3", className: "C1", status: "pending" },
    ]);
    const source = await query<{ studentId: string; status: string; endOn: string }>(sql`
      SELECT student_id AS "studentId", status, end_on::text AS "endOn" FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND session_id = 'src' ORDER BY student_id`);
    expect(source).toEqual([
      { studentId: "s1", status: "promoted", endOn: "2026-12-31" },
      { studentId: "s2", status: "graduated", endOn: "2026-12-31" },
      { studentId: "s3", status: "retained", endOn: "2026-12-31" },
    ]);
    expect(await findPromotionRun(TENANT, "run-1")).toMatchObject({ status: "completed" });
    const auditRows = await query<{
      actionType: string;
      realUserId: string;
      newState: string;
    }>(sql`
      SELECT action_type AS "actionType", real_user_id AS "realUserId", new_state AS "newState"
        FROM audit_trail_events
       WHERE workspace_subdomain = ${TENANT} AND table_name = 'session_promotion_runs'
         AND record_id = 'run-1' ORDER BY id`);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.actionType).toBe("UPDATE");
    expect(auditRows[0]?.realUserId).toBe("u-admin");
    expect(JSON.parse(auditRows[0]?.newState ?? "{}")).toMatchObject({
      status: "completed",
      operation: "rollover_completed",
    });
  });

  it("given a duplicate run, should copy the structure without students", async () => {
    // Arrange
    await createPromotionRun(TENANT, {
      id: "run-2",
      sourceSessionId: "src",
      mode: "duplicate",
      classMap: [],
      createdBy: "u-admin",
    });

    // Act
    const result = await run(() =>
      executeSessionRollover(
        TENANT,
        "u-admin",
        {
          runId: "run-2",
          sourceSessionId: "src",
          body: { ...body, mode: "duplicate", copy: { ...body.copy, fees: false } },
        },
        noProgress,
      ),
    );

    // Assert
    const target = await findSessionById(TENANT, result.targetSessionId);
    const [{ count }] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND session_id = ${result.targetSessionId}`);
    expect(result.carried).toBe(0);
    expect(count).toBe(0);
    expect(target?.classes.map((cls) => cls.fees.length)).toEqual([0, 0]);
  });

  it("given a target with fewer seats than students, should refuse the carry and close nothing", async () => {
    // Arrange — one-seat target for two live source students.
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "tight",
        name: "Tight Year",
        status: "in_progress",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        overlapExempt: true,
        classes: [
          {
            id: "tight-class",
            name: "Tight",
            maxStudents: 1,
            sections: [{ id: "tight-a", name: "A", capacity: 1 }],
          },
        ],
      }),
    );
    for (const studentId of ["s1", "s2"]) {
      await run(() =>
        bulkEnrollStudentsIntoClass(TENANT, {
          studentIds: [studentId],
          sessionId: "tight",
          classId: "tight-class",
          mode: "add",
        }),
      );
    }
    await createPromotionRun(TENANT, {
      id: "run-tight",
      sourceSessionId: "tight",
      mode: "promote",
      classMap: [{ sourceClassId: "tight-class", nextClassId: "tight-class" }],
      createdBy: "u-admin",
    });

    // Act / Assert — the whole carry is rejected and the source stays untouched.
    await expect(
      run(() =>
        executeSessionRollover(
          TENANT,
          "u-admin",
          {
            runId: "run-tight",
            sourceSessionId: "tight",
            body: sessionRolloverBodySchema.parse({
              mode: "promote",
              target: { name: "Tight Next", startDate: "2028-01-01", endDate: "2028-12-31" },
              copy: { staff: false, calendar: false },
              classMap: [{ sourceClassId: "tight-class", nextClassId: "tight-class" }],
            }),
          },
          noProgress,
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "rollover_blocked" });
    const [{ live }] = await query<{ live: number }>(sql`
      SELECT count(*)::int AS live FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND session_id = 'tight'
         AND status NOT IN ('promoted', 'retained', 'graduated', 'left')`);
    const tightTarget = (await findPromotionRun(TENANT, "run-tight"))?.targetSessionId ?? "";
    const [{ carried }] = await query<{ carried: number }>(sql`
      SELECT count(*)::int AS carried FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND promoted_from_enrollment_id IS NOT NULL
         AND session_id = ${tightTarget}`);
    expect(live).toBe(2);
    expect(carried).toBe(0);
  });

  it("given an aborted attempt, should queue the run and resume without a second target", async () => {
    // Arrange — an isolated source session for the resume flow.
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "resume-src",
        name: "Resume Source",
        status: "in_progress",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        overlapExempt: true,
        classes: [
          {
            id: "resume-class",
            name: "Resume",
            sections: [{ id: "resume-a", name: "A", capacity: 10 }],
          },
        ],
      }),
    );
    await run(() =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s1"],
        sessionId: "resume-src",
        classId: "resume-class",
        mode: "add",
      }),
    );
    await createPromotionRun(TENANT, {
      id: "run-resume",
      sourceSessionId: "resume-src",
      mode: "promote",
      classMap: [{ sourceClassId: "resume-class", nextClassId: "resume-class" }],
      createdBy: "u-admin",
    });
    const payload = {
      runId: "run-resume",
      sourceSessionId: "resume-src",
      body: sessionRolloverBodySchema.parse({
        mode: "promote",
        target: { name: "Resume Next", startDate: "2029-01-01", endDate: "2029-12-31" },
        copy: { staff: false, calendar: false },
        classMap: [{ sourceClassId: "resume-class", nextClassId: "resume-class" }],
      }),
    };

    // Act — first attempt is interrupted, then the retry resumes the same run.
    await expect(
      run(() =>
        executeSessionRollover(TENANT, "u-admin", payload, noProgress, {
          signal: AbortSignal.abort(),
          attempt: 1,
          maxAttempts: 3,
        }),
      ),
    ).rejects.toThrow();
    const interrupted = await findPromotionRun(TENANT, "run-resume");
    expect(interrupted).toMatchObject({ status: "queued" });
    const resumed = await run(() =>
      executeSessionRollover(TENANT, "u-admin", payload, noProgress, {
        attempt: 2,
        maxAttempts: 3,
      }),
    );
    const again = await run(() =>
      executeSessionRollover(TENANT, "u-admin", payload, noProgress, {
        attempt: 3,
        maxAttempts: 3,
      }),
    );

    // Assert — exactly one target and one carried enrollment, run completed idempotently.
    expect(resumed.targetSessionId).toBeTruthy();
    expect(again.targetSessionId).toBe(resumed.targetSessionId);
    expect(await findPromotionRun(TENANT, "run-resume")).toMatchObject({
      status: "completed",
      promoted: 1,
    });
    const [{ count }] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND session_id = ${resumed.targetSessionId}
         AND promoted_from_enrollment_id IS NOT NULL`);
    expect(count).toBe(1);
  });
});
