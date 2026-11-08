import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { enrollments, students, studentEnrolledSessions, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { cascadeSoftDeleteEnrollmentsForStudents } from "../../db/repositories/studentEnrollmentCascade.js";
import { transitionSession } from "../../sessions/use-cases/sessionTransitionService.js";
import { registrationLinkUseCases } from "../../sessions/use-cases/registrationLinkUseCases.js";
import { submitPublicRegistration } from "../../enrollments/use-cases/registrationPublicUseCases.js";
import { admissionsUseCases } from "../../enrollments/use-cases/admissionsUseCases.js";
import { enrollmentOperationsUseCases as ops } from "../../enrollments/use-cases/enrollmentOperationsUseCases.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  daysFromToday,
  requireDatabaseConnection,
  todayIso,
  uniqueTenant,
} from "./dbTestSupport.js";

const TENANT = uniqueTenant("enrollment-journey-test");
const SESSION = "journey-ses";
const CLASS = "journey-cls";
const admin: User = {
  id: "journey-admin",
  email: "admin@example.test",
  name: "Journey Admin",
  role: "admin",
  workspaceSubdomain: TENANT,
};

function applicant(name: string, phone: string) {
  return {
    classId: CLASS,
    fullName: name,
    guardianName: `${name} Guardian`,
    dateOfBirth: daysFromToday(-365 * 9),
    gender: "male" as const,
    phone,
  };
}

async function query<T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) {
  return withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);
}

async function applicationByReference(reference: string) {
  const [row] = await query<{
    id: string;
    status: string;
    studentId: string | null;
    enrollmentId: string | null;
  }>(sql`
    SELECT id, status, student_id AS "studentId", enrollment_id AS "enrollmentId"
      FROM registration_applications
     WHERE workspace_subdomain = ${TENANT} AND reference = ${reference}`);
  return row!;
}

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

let slug = "";

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, (tx) =>
    tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Journey Madrasa",
      enabled: true,
    }),
  );
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: SESSION,
      name: "Journey session",
      status: "open",
      startDate: daysFromToday(-7),
      endDate: daysFromToday(90),
      baseFee: 500,
      classes: [
        {
          id: CLASS,
          name: "Journey class",
          gender: "male",
          minAge: 5,
          maxAge: 18,
          sections: [{ id: "journey-sec", name: "A", capacity: 1 }],
        },
      ],
    }),
  );
  const link = await runWithTenant(TENANT, () =>
    registrationLinkUseCases.save(
      TENANT,
      SESSION,
      "journey-link",
      { requiresReview: true, classIds: [CLASS] },
      "journey-admin",
    ),
  );
  slug = link.slug;
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("enrollment lifecycle journey (apply → waitlist → offer → enroll → drop → cascade)", () => {
  it("carries an applicant through the complete waitlist-to-enrollment lifecycle", async () => {
    const first = await submitPublicRegistration(
      TENANT,
      slug,
      applicant("Journey First", "03001110001"),
      null,
    );
    const second = await submitPublicRegistration(
      TENANT,
      slug,
      applicant("Journey Waiter", "03001110002"),
      null,
    );
    const firstApp = await applicationByReference(first.reference);
    const secondApp = await applicationByReference(second.reference);
    expect(firstApp.status).toBe("submitted");

    // Approve the first applicant: creates a student + enrollment and fills the only seat.
    const approved = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [firstApp.id], decision: "approve" }, admin),
    );
    expect(approved).toMatchObject({ updated: 1, failures: [] });
    const firstAfter = await applicationByReference(first.reference);
    expect(firstAfter.status).toBe("approved");
    expect(firstAfter.enrollmentId).toBeTruthy();
    const [seat] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND session_id = ${SESSION}
         AND deleted_at IS NULL AND status NOT IN ('cancelled','withdrawn','promoted','retained','graduated','left')`);
    expect(Number(seat?.count ?? 0)).toBe(1);

    // Waitlist the second applicant (no seat is hard-reserved).
    const waitlisted = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [secondApp.id], decision: "waitlist" }, admin),
    );
    expect(waitlisted).toMatchObject({ updated: 1, failures: [] });
    expect((await applicationByReference(second.reference)).status).toBe("waitlisted");

    // Drop the first enrollment: the freed seat flags the oldest waitlisted application.
    const withdrawn = await runWithTenant(TENANT, () =>
      ops.withdraw(
        TENANT,
        String(firstAfter.enrollmentId),
        { effectiveOn: todayIso(), reason: "Family relocated" },
        admin,
      ),
    );
    expect(withdrawn.enrollment.status).toBe("withdrawn");
    const offered = await applicationByReference(second.reference);
    expect(offered.status).toBe("under_review");
    const [offerRow] = await query<{ expiry: string | null; note: string | null }>(sql`
      SELECT to_char(waitlist_offer_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expiry,
             review_reason AS note
        FROM registration_applications
       WHERE workspace_subdomain = ${TENANT} AND id = ${offered.id}`);
    expect(offerRow?.expiry).toBeTruthy();
    expect(offerRow?.note).toMatch(/^Seat available/);

    // An expired offer must not be approved (the seat was re-offered by the sweep).
    await query(sql`
      UPDATE registration_applications SET waitlist_offer_expires_at = now() - interval '1 hour'
       WHERE workspace_subdomain = ${TENANT} AND id = ${offered.id}`);
    const expiredApproval = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [offered.id], decision: "approve" }, admin),
    );
    expect(expiredApproval.updated).toBe(0);
    expect(expiredApproval.failures[0]?.message).toMatch(/expired/i);
    expect((await applicationByReference(second.reference)).status).toBe("under_review");

    // Re-offer (fresh window) and approve: student + enrollment are created for the waitlisted applicant.
    await query(sql`
      UPDATE registration_applications SET waitlist_offer_expires_at = now() + interval '1 hour'
       WHERE workspace_subdomain = ${TENANT} AND id = ${offered.id}`);
    const enrolled = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [offered.id], decision: "approve" }, admin),
    );
    expect(enrolled).toMatchObject({ updated: 1, failures: [] });
    const secondAfter = await applicationByReference(second.reference);
    expect(secondAfter.status).toBe("approved");
    expect(secondAfter.studentId).toBeTruthy();
    expect(secondAfter.enrollmentId).toBeTruthy();

    // The waitlisted student's session membership is derived from the new enrollment.
    const [member] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM student_session_memberships
       WHERE workspace_subdomain = ${TENANT} AND student_id = ${secondAfter.studentId}`);
    expect(Number(member?.count ?? 0)).toBe(1);

    // Drop the second enrollment: the seat is freed again and no more applications wait.
    await runWithTenant(TENANT, () =>
      ops.withdraw(
        TENANT,
        String(secondAfter.enrollmentId),
        { effectiveOn: todayIso(), reason: "Completed trial" },
        admin,
      ),
    );
    const [remaining] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM registration_applications
       WHERE workspace_subdomain = ${TENANT} AND status = 'waitlisted'`);
    expect(Number(remaining?.count ?? 0)).toBe(0);

    // Cascade: trashing the student soft-deletes the enrollment and drops membership.
    const cascade = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cascade.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cascade.tx.execute(sql`SELECT set_config('app.current_tenant', ${TENANT}, true)`);
      await cascade.tx.execute(sql`SELECT set_config('app.include_deleted', 'true', true)`);
      await cascade.tx
        .update(students)
        .set({ deletedAt: new Date(), deletedBy: "journey-admin" })
        .where(
          and(eq(students.workspaceSubdomain, TENANT), eq(students.id, secondAfter.studentId!)),
        );
      await cascadeSoftDeleteEnrollmentsForStudents(
        cascade.tx,
        TENANT,
        [secondAfter.studentId!],
        "journey-admin",
        "Student trashed",
        new Date(),
      );
      await cascade.commit();
    } catch (error) {
      await cascade.rollback().catch(() => undefined);
      throw error;
    }

    const [cascaded] = await query<{ deletedAt: Date | null; cascade: boolean | null }>(sql`
      SELECT deleted_at AS "deletedAt", deleted_with_cascade AS "cascade"
        FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND id = ${secondAfter.enrollmentId}`);
    expect(cascaded?.deletedAt).not.toBeNull();
    expect(cascaded?.cascade).toBe(true);
    const [pairs] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM student_session_memberships
       WHERE workspace_subdomain = ${TENANT} AND student_id = ${secondAfter.studentId}`);
    expect(Number(pairs?.count ?? 0)).toBe(0);
    const [direct] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND student_id = ${secondAfter.studentId}
         AND deleted_at IS NULL`);
    expect(Number(direct?.count ?? 0)).toBe(0);
    expect(
      await withTenant(TENANT, (tx) =>
        tx
          .select({ id: studentEnrolledSessions.studentId })
          .from(studentEnrolledSessions)
          .where(eq(studentEnrolledSessions.workspaceSubdomain, TENANT)),
      ),
    ).toEqual([]);
    expect(
      await withTenant(TENANT, (tx) =>
        tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.status, "confirmed")),
          ),
      ),
    ).toHaveLength(0);
  }, 60_000);

  it("completes and cancels sessions with live enrollments, closing placements and membership", async () => {
    await withTenant(TENANT, (tx) =>
      tx.insert(students).values(
        ["jc-1", "jc-2", "jc-3", "jc-4"].map((id) => ({
          id,
          workspaceSubdomain: TENANT,
          grNumber: `gr-${id}`,
          status: "active" as const,
        })),
      ),
    );
    // Separate, non-overlapping windows: the journey session above holds (-7, +90).
    for (const [sessionId, className, startOffset] of [
      ["journey-complete", "Complete class", -400],
      ["journey-cancel", "Cancel class", -600],
    ] as const) {
      await saveSession(
        TENANT,
        SessionSchema.parse({
          id: sessionId,
          name: sessionId,
          status: "in_progress",
          startDate: daysFromToday(startOffset),
          endDate: daysFromToday(startOffset + 60),
          baseFee: 100,
          classes: [
            {
              id: `${sessionId}-cls`,
              name: className,
              sections: [{ id: `${sessionId}-sec`, name: "A", capacity: 5 }],
            },
          ],
        }),
      );
    }
    const studentsBySession = {
      "journey-complete": ["jc-1", "jc-2"],
      "journey-cancel": ["jc-3", "jc-4"],
    } as const;
    for (const [sessionId, studentIds] of Object.entries(studentsBySession)) {
      await runWithTenant(TENANT, () =>
        bulkEnrollStudentsIntoClass(TENANT, {
          studentIds: [...studentIds],
          sessionId,
          classId: `${sessionId}-cls`,
          sectionId: `${sessionId}-sec`,
          mode: "add",
        }),
      );
    }

    const completed = await runWithTenant(TENANT, () =>
      transitionSession(TENANT, "journey-complete", { to: "completed", reason: "Term ended" }),
    );
    const cancelled = await runWithTenant(TENANT, () =>
      transitionSession(TENANT, "journey-cancel", { to: "cancelled", reason: "Term cancelled" }),
    );
    expect(completed.ended).toBe(2);
    expect(cancelled.ended).toBe(2);

    const rows = await query<{ sessionId: string; status: string; endOn: string | null }>(sql`
      SELECT session_id AS "sessionId", status, end_on AS "endOn"
        FROM enrollments
       WHERE workspace_subdomain = ${TENANT}
         AND session_id IN ('journey-complete', 'journey-cancel')
       ORDER BY session_id, student_id`);
    expect(rows.map((row) => `${row.sessionId}:${row.status}`)).toEqual([
      "journey-cancel:cancelled",
      "journey-cancel:cancelled",
      "journey-complete:completed",
      "journey-complete:completed",
    ]);
    expect(rows.every((row) => row.endOn !== null)).toBe(true);
    const openPlacements = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollment_placements p
        JOIN enrollments e ON e.workspace_subdomain = p.workspace_subdomain AND e.id = p.enrollment_id
       WHERE e.workspace_subdomain = ${TENANT}
         AND e.session_id IN ('journey-complete', 'journey-cancel')
         AND p.end_on IS NULL`);
    expect(Number(openPlacements[0]?.count ?? 0)).toBe(0);
    // Completed enrollments still hold a seat (revenue/SSOT rule); cancelled ones release it.
    const [completedMembership] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM student_session_memberships
       WHERE workspace_subdomain = ${TENANT} AND session_id = 'journey-complete'`);
    expect(Number(completedMembership?.count ?? 0)).toBe(2);
    const [cancelledMembership] = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM student_session_memberships
       WHERE workspace_subdomain = ${TENANT} AND session_id = 'journey-cancel'`);
    expect(Number(cancelledMembership?.count ?? 0)).toBe(0);
  }, 60_000);
});
