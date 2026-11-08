import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  contacts,
  financeInvoices,
  registrationApplications,
  sessionRegistrationLinks,
  students,
  workspaces,
} from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { bulkSoftDeleteEnrollments } from "../../db/repositories/enrollmentRepositoryPersist.js";
import { listEnrollmentsPage } from "../../db/repositories/enrollmentRepositoryList.js";
import { applyEnrollmentTransfer } from "../../db/repositories/enrollmentOperationsRepository.js";
import {
  classHasFreeSeat,
  revertSeatOffersForClass,
} from "../../db/repositories/registrationWaitlistRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { offerFreedSeat } from "../../enrollments/use-cases/admissionsWaitlistUseCases.js";
import { expireWaitlistOffers } from "../../enrollments/use-cases/admissionsWaitlistExpiry.js";
import { stampAttendanceSections } from "../../attendance/use-cases/attendanceSectionStamp.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { enrollmentsUseCases } from "../../enrollments/use-cases/enrollmentsUseCases.js";
import { aggregateEnrollmentsWidgetQueries } from "../../db/repositories/enrollmentRepositoryWidgets.js";
import { loadEnrollmentsReportAggregatesSql } from "../../db/repositories/enrollmentRepositoryReport.js";
import { importEnrollmentRows } from "../../enrollments/use-cases/enrollmentImportUseCases.js";
import { preflightEnrollmentImport } from "../../enrollments/use-cases/enrollmentImportUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "enrollments-subsystems-test";
const SESSION = "ses-sub";
const CLASS = "cls-sub";
const today = todayInTimeZone("UTC");

const fee = {
  baseFee: 0,
  discountType: "none",
  discountLabel: "",
  discountPct: 0,
  discountAmt: 0,
  finalFee: 0,
};

const query = <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) =>
  withTenant(TENANT, async (tx) => (await tx.execute<T>(statement)).rows);

async function membershipCount(): Promise<number> {
  const [row] = await query<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM student_session_memberships
     WHERE workspace_subdomain = ${TENANT}`);
  return Number(row?.count ?? 0);
}

async function enrollmentIdOf(studentId: string): Promise<string> {
  const [row] = await query<{ id: string }>(sql`
    SELECT id FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = ${studentId}`);
  return row!.id;
}

async function insertApplication(id: string, createdAt: string): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx.insert(registrationApplications).values({
      id,
      workspaceSubdomain: TENANT,
      reference: `REF-${id}`,
      linkId: "link-sub",
      sessionId: SESSION,
      classId: CLASS,
      fullName: `Applicant ${id}`,
      guardianName: "Guardian",
      dateOfBirth: "2015-01-01",
      gender: "male",
      phone: "03001234567",
      status: "waitlisted",
      createdAt: new Date(createdAt),
    }),
  );
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Subsystems", enabled: true });
    await tx.insert(students).values(
      ["s1", "s2", "s3", "s4"].map((id) => ({
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
      id: SESSION,
      name: "Subsystems session",
      status: "in_progress",
      startDate: "2026-01-01",
      classes: [
        {
          id: CLASS,
          name: "Subsystems class",
          minAge: 0,
          maxAge: 100,
          gender: "mixed",
          sections: [
            { id: "sec-1", name: "A", capacity: 2 },
            { id: "sec-2", name: "B", capacity: 1 },
          ],
        },
      ],
    }),
  );
  await runWithTenant(TENANT, () =>
    bulkEnrollStudentsIntoClass(TENANT, {
      studentIds: ["s1", "s2"],
      sessionId: SESSION,
      classId: CLASS,
      sectionId: "sec-1",
      mode: "add",
    }),
  );
  await withTenant(TENANT, (tx) =>
    tx.insert(sessionRegistrationLinks).values({
      id: "link-sub",
      workspaceSubdomain: TENANT,
      sessionId: SESSION,
      slug: "sub-link",
      title: "Sub link",
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

describe("enrollment domain subsystems (real Postgres)", () => {
  it("membership view drops an enrollment whose session or student is archived", async () => {
    expect(await membershipCount()).toBe(2);
    await query(
      sql`UPDATE sessions SET deleted_at = now() WHERE workspace_subdomain = ${TENANT} AND id = ${SESSION}`,
    );
    expect(await membershipCount()).toBe(0);
    await query(
      sql`UPDATE sessions SET deleted_at = NULL WHERE workspace_subdomain = ${TENANT} AND id = ${SESSION}`,
    );
    await query(
      sql`UPDATE students SET deleted_at = now() WHERE workspace_subdomain = ${TENANT} AND id = 's1'`,
    );
    expect(await membershipCount()).toBe(1);
    await query(
      sql`UPDATE students SET deleted_at = NULL WHERE workspace_subdomain = ${TENANT} AND id = 's1'`,
    );
  });

  it("rename triggers refresh the denormalized enrollment names", async () => {
    await query(
      sql`UPDATE sessions SET name = 'Renamed session' WHERE workspace_subdomain = ${TENANT} AND id = ${SESSION}`,
    );
    await query(
      sql`UPDATE session_classes SET name = 'Renamed class' WHERE workspace_subdomain = ${TENANT} AND id = ${CLASS}`,
    );

    await withTenant(TENANT, async (tx) => {
      await tx.insert(contacts).values({
        id: "contact-s1",
        workspaceSubdomain: TENANT,
        firstName: "S1",
        name: "Old name",
      });
      await tx.update(students).set({ contactId: "contact-s1" }).where(eq(students.id, "s1"));
    });
    await query(
      sql`UPDATE contacts SET name = 'New name' WHERE workspace_subdomain = ${TENANT} AND id = 'contact-s1'`,
    );

    const [row] = await query<{ sessionName: string; className: string; studentName: string }>(sql`
      SELECT session_name AS "sessionName", class_name AS "className", student_name AS "studentName"
        FROM enrollments WHERE workspace_subdomain = ${TENANT} AND student_id = 's1'`);
    expect(row).toEqual({
      sessionName: "Renamed session",
      className: "Renamed class",
      studentName: "New name",
    });
  });

  it("blocks trashing an enrollment that still has open invoices", async () => {
    const id = await enrollmentIdOf("s2");
    await withTenant(TENANT, (tx) =>
      tx.insert(financeInvoices).values({
        id: "inv-open",
        workspaceSubdomain: TENANT,
        studentId: "s2",
        dueDate: today,
        status: "pending",
        enrollmentId: id,
      }),
    );

    await expect(bulkSoftDeleteEnrollments(TENANT, [id], "admin", "test")).rejects.toMatchObject({
      statusCode: 409,
    });

    await query(
      sql`UPDATE finance_invoices SET status = 'cancelled' WHERE workspace_subdomain = ${TENANT} AND id = 'inv-open'`,
    );
    await expect(bulkSoftDeleteEnrollments(TENANT, [id], "admin", "test")).resolves.toEqual({
      succeeded: 1,
      failed: 0,
    });
  });

  it("rejects a current-day attendance mark for a student who is not enrolled", async () => {
    const rejected = await stampAttendanceSections(TENANT, [
      { classId: CLASS, studentId: "s4", date: today },
    ]);
    expect(rejected.rejected).toHaveLength(1);
    expect(rejected.rejected[0]?.reason).toBe("not_enrolled");

    const enrolled = await stampAttendanceSections(TENANT, [
      { classId: CLASS, studentId: "s1", date: today, sectionId: null },
    ]);
    expect(enrolled.rejected).toEqual([]);
    expect(enrolled.records[0]?.sectionId).toBe("sec-1");

    // Historical backfill for a former student is allowed (no section of record exists).
    const historical = await stampAttendanceSections(TENANT, [
      { classId: CLASS, studentId: "s4", date: "2024-01-10" },
    ]);
    expect(historical.rejected).toEqual([]);
  });

  it("offers freed seats FIFO with a window, then reverts expired offers", async () => {
    // Isolate from any offer state left by another test/source order.
    await query(sql`UPDATE registration_applications
      SET status = 'waitlisted', waitlist_offer_expires_at = NULL
      WHERE workspace_subdomain = ${TENANT} AND status = 'under_review'`);
    await insertApplication("app-1", "2026-01-01T00:00:00Z");
    await insertApplication("app-2", "2026-01-02T00:00:00Z");

    const first = await offerFreedSeat(TENANT, CLASS);
    expect(first?.id).toBe("app-1");
    const [offered] = await query<{ expires: string | null; status: string }>(sql`
      SELECT waitlist_offer_expires_at::text AS expires, status
        FROM registration_applications WHERE workspace_subdomain = ${TENANT} AND id = 'app-1'`);
    expect(offered?.status).toBe("under_review");
    expect(offered?.expires).not.toBeNull();

    const second = await offerFreedSeat(TENANT, CLASS);
    expect(second?.id).toBe("app-2");

    await query(
      sql`UPDATE registration_applications SET waitlist_offer_expires_at = now() - interval '1 hour' WHERE workspace_subdomain = ${TENANT} AND id = 'app-1'`,
    );
    const sweep = await expireWaitlistOffers();
    expect(sweep.reverted).toBe(1);
    const [reverted] = await query<{ status: string; expires: string | null }>(sql`
      SELECT status, waitlist_offer_expires_at::text AS expires
        FROM registration_applications WHERE workspace_subdomain = ${TENANT} AND id = 'app-1'`);
    expect(reverted).toEqual({ status: "waitlisted", expires: null });
  });

  it("reverts unconsumed offers when the class no longer has a free seat", async () => {
    // Make the fixture self-contained: release s2's seat (never s1/s4, which later tests count)
    // and clear every open offer from an earlier test/source order.
    await query(sql`UPDATE enrollments SET status = 'withdrawn'
      WHERE workspace_subdomain = ${TENANT} AND student_id = 's2' AND deleted_at IS NULL
        AND status NOT IN ('cancelled','withdrawn','promoted','retained','graduated','left')`);
    await query(sql`UPDATE registration_applications
      SET status = 'waitlisted', waitlist_offer_expires_at = NULL
      WHERE workspace_subdomain = ${TENANT} AND status = 'under_review'`);
    expect(await classHasFreeSeat(TENANT, CLASS)).toBe(true);
    await withTenant(TENANT, (tx) =>
      tx.insert(registrationApplications).values({
        id: "app-late",
        workspaceSubdomain: TENANT,
        reference: "REF-late",
        linkId: "link-sub",
        sessionId: SESSION,
        classId: CLASS,
        fullName: "Late applicant",
        guardianName: "Guardian",
        dateOfBirth: "2015-01-01",
        gender: "male",
        phone: "03001234567",
        status: "under_review",
        waitlistOfferedAt: new Date(),
        waitlistOfferExpiresAt: new Date(Date.now() + 3_600_000),
      }),
    );
    const closed = await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s3"],
        sessionId: SESSION,
        classId: CLASS,
        sectionId: "sec-2",
        mode: "add",
      }),
    );
    expect(closed).toEqual({ succeeded: 1, failed: 0 });
    // Fill the remaining sec-1 seat so the class is genuinely full.
    const filled = await runWithTenant(TENANT, () =>
      bulkEnrollStudentsIntoClass(TENANT, {
        studentIds: ["s4"],
        sessionId: SESSION,
        classId: CLASS,
        sectionId: "sec-1",
        mode: "add",
      }),
    );
    expect(filled).toEqual({ succeeded: 1, failed: 0 });
    expect(await classHasFreeSeat(TENANT, CLASS)).toBe(false);

    // Filling the last seat reverted the offer automatically (post-commit hook).
    const [late] = await query<{ status: string; expires: string | null }>(sql`
      SELECT status, waitlist_offer_expires_at::text AS expires
        FROM registration_applications WHERE workspace_subdomain = ${TENANT} AND id = 'app-late'`);
    expect(late).toEqual({ status: "waitlisted", expires: null });
    // The manual sweep is idempotent.
    expect(await revertSeatOffersForClass(TENANT, CLASS)).toEqual([]);
  });

  it("compare-and-sets the placement on transfer so a stale from is rejected", async () => {
    const id = await enrollmentIdOf("s3");
    // s3 currently lives in sec-2; a stale transfer that claims sec-1 must not move it.
    await expect(
      applyEnrollmentTransfer(TENANT, {
        enrollmentId: id,
        from: { classId: CLASS, sectionId: "sec-1" },
        to: { classId: CLASS, className: "Renamed class", sectionId: "sec-1" },
        fee,
        effectiveOn: today,
        reason: "stale",
        actor: { userId: null, label: "test" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const [row] = await query<{ sectionId: string | null }>(sql`
      SELECT section_id AS "sectionId" FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND id = ${id}`);
    expect(row?.sectionId).toBe("sec-2");
  });

  it("filters the list by student/section and returns the full list projection", async () => {
    await query(sql`UPDATE enrollments SET notes = 'Needs a Quran folder'
      WHERE workspace_subdomain = ${TENANT} AND student_id = 's1'`);

    const s3Rows = await listEnrollmentsPage(TENANT, { studentId: "s3", page: 1, limit: 10 });
    expect(s3Rows.enrollments.map((row) => row.studentId)).toEqual(["s3"]);
    expect(s3Rows.enrollments[0]?.sectionId).toBe("sec-2");

    const secOneRows = await listEnrollmentsPage(TENANT, {
      sectionId: "sec-1",
      page: 1,
      limit: 10,
    });
    expect(secOneRows.enrollments.map((row) => row.studentId).sort()).toEqual(["s1", "s4"]);

    const withNotes = await listEnrollmentsPage(TENANT, { studentId: "s1", page: 1, limit: 10 });
    expect(withNotes.enrollments[0]?.notes).toBe("Needs a Quran folder");
    expect(withNotes.enrollments[0]?.timeline).toEqual([]);

    // A literal '%' is escaped, not treated as an unbounded wildcard.
    const wildcard = await listEnrollmentsPage(TENANT, { search: "%", page: 1, limit: 10 });
    expect(wildcard.enrollments).toEqual([]);
  });

  it("pages with a keyset cursor and returns the next cursor", async () => {
    const first = await listEnrollmentsPage(TENANT, { page: 1, limit: 1 });
    expect(first.enrollments).toHaveLength(1);
    expect(first.nextCursor).toBeUndefined();

    const cursorPage = await listEnrollmentsPage(TENANT, {
      page: 1,
      limit: 1,
      afterId: first.enrollments[0]!.id,
    });
    expect(cursorPage.enrollments).toHaveLength(1);
    expect(cursorPage.enrollments[0]!.id > first.enrollments[0]!.id).toBe(true);
    expect(cursorPage.nextCursor).toBe(
      cursorPage.hasMore ? cursorPage.enrollments[0]!.id : undefined,
    );
  });

  it("writes immutable before/after audit rows for create, update, delete and restore", async () => {
    const id = await enrollmentIdOf("s1");

    await runWithTenant(TENANT, () =>
      enrollmentsUseCases.updateEnrollmentById(id, { status: "confirmed" } as never),
    );
    await runWithTenant(TENANT, () =>
      enrollmentsUseCases.updateEnrollmentById(id, { notes: "audited note" } as never),
    );
    await runWithTenant(TENANT, () => enrollmentsUseCases.deleteEnrollmentById(id, "admin"));
    await runWithTenant(TENANT, () => enrollmentsUseCases.bulkRestoreEnrollments([id], "admin"));

    const rows = await query<{
      actionType: string;
      oldState: string | null;
      newState: string;
      realUserId: string;
    }>(sql`
      SELECT action_type AS "actionType", old_state AS "oldState", new_state AS "newState",
             real_user_id AS "realUserId"
        FROM audit_trail_events
       WHERE workspace_subdomain = ${TENANT} AND table_name = 'enrollments' AND record_id = ${id}
       ORDER BY transaction_timestamp, id`);
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const parsed = rows.map((row) => ({
      actionType: row.actionType,
      oldState: row.oldState ? (JSON.parse(row.oldState) as Record<string, unknown>) : null,
      newState: JSON.parse(row.newState) as Record<string, unknown>,
    }));
    const statusChange = parsed.find(
      (row) => row.actionType === "UPDATE" && row.newState.reasonCode === "status_change",
    );
    expect(statusChange?.oldState).toMatchObject({ status: "pending" });
    expect(statusChange?.newState).toMatchObject({ status: "confirmed" });
    expect(
      parsed.some(
        (row) =>
          row.actionType === "UPDATE" &&
          row.newState.reasonCode === "details_edit" &&
          row.newState.notesChanged === true,
      ),
    ).toBe(true);
    expect(parsed.some((row) => row.actionType === "DELETE")).toBe(true);
    expect(parsed.some((row) => row.actionType === "RESTORE")).toBe(true);

    // Bulk/approval-created enrollments carry one CREATE row each.
    const created = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM audit_trail_events
       WHERE workspace_subdomain = ${TENANT} AND table_name = 'enrollments'
         AND action_type = 'CREATE'`);
    expect(Number(created[0]?.count ?? 0)).toBeGreaterThan(0);
  });

  it("keeps tenant scoping on the enrollment tables", async () => {
    const id = await enrollmentIdOf("s3");
    const foreign = await withTenant("another-workspace", (tx) =>
      tx.execute<{ id: string }>(sql`
        SELECT id FROM enrollments WHERE workspace_subdomain = 'another-workspace' AND id = ${id}`),
    );
    expect(foreign.rows).toEqual([]);
  });

  it("imports enrollments idempotently and reports row errors", async () => {
    await withTenant(TENANT, (tx) =>
      tx.insert(students).values({
        id: "s5",
        workspaceSubdomain: TENANT,
        grNumber: "gr-s5",
        status: "active",
      }),
    );
    // A dedicated session/class with free seats: the fixture class is full after the earlier tests.
    await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "ses-import",
        name: "Import session",
        status: "in_progress",
        startDate: "2026-01-01",
        classes: [
          {
            id: "cls-import",
            name: "Import class",
            sections: [{ id: "sec-import", name: "A", capacity: 10 }],
          },
        ],
      }),
    );
    const rows = [
      {
        studentId: "gr-s5",
        sessionId: "ses-import",
        classId: "cls-import",
        status: "confirmed",
        baseFee: 100,
        finalFee: 100,
      },
      { studentId: "gr-s5", sessionId: "ses-import", classId: "cls-import", status: "confirmed" },
      { studentId: "gr-s5", sessionId: "ses-import", classId: "missing-class" },
      { studentId: "gr-s5", sessionId: "ses-import", classId: "cls-import", status: "withdrawn" },
    ];
    const ctx = {
      tenant: TENANT,
      userId: "u-admin",
      jobId: "job-import-1",
      viewerRole: "admin",
      updateProgress: async () => undefined,
    } as const;

    // Pre-flight writes nothing and reports the duplicate + the two invalid rows.
    const preflight = await preflightEnrollmentImport(TENANT, rows as never);
    expect(preflight).toMatchObject({ total: 4, valid: 1, invalid: 3, duplicates: 1 });
    expect(preflight.errors.map((error: { row: number }) => error.row).sort()).toEqual([2, 3, 4]);
    const before = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND student_id = 's5' AND session_id = 'ses-import'`);
    expect(Number(before[0]?.count ?? 0)).toBe(0);

    const first = await runWithTenant(TENANT, () => importEnrollmentRows(rows as never, ctx));
    expect(first.imported).toBe(1);
    expect(first.errors?.map((error) => error.row).sort()).toEqual([2, 3, 4]);

    // A retry imports nothing new: the pair already exists and the rest are row errors.
    const second = await runWithTenant(TENANT, () => importEnrollmentRows(rows as never, ctx));
    expect(second.imported).toBe(0);
    expect(second.errors?.map((error) => error.row).sort()).toEqual([2, 3, 4]);

    const live = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM enrollments
       WHERE workspace_subdomain = ${TENANT} AND student_id = 's5'
         AND session_id = 'ses-import' AND deleted_at IS NULL`);
    expect(Number(live[0]?.count ?? 0)).toBe(1);

    const audited = await query<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM audit_trail_events
       WHERE workspace_subdomain = ${TENANT} AND table_name = 'enrollments'
         AND action_type = 'CREATE'
         AND record_id IN (SELECT id FROM enrollments
                            WHERE workspace_subdomain = ${TENANT} AND student_id = 's5'
                              AND session_id = 'ses-import')`);
    expect(Number(audited[0]?.count ?? 0)).toBe(1);
  });

  it("honors widget filters and rejects unknown fields", async () => {
    const results = await aggregateEnrollmentsWidgetQueries(TENANT, [
      {
        id: "confirmed",
        operation: "count",
        filterField: "status",
        filterOperator: "equals",
        filterValue: "confirmed",
      },
      {
        id: "multi",
        operation: "count",
        filters: [
          { field: "status", operator: "equals", value: "confirmed" },
          { field: "studentId", operator: "equals", value: "s1" },
        ],
      },
    ] as never);
    expect(results.confirmed?.value).toBeGreaterThan(0);
    expect(results.multi?.value).toBe(1);

    await expect(
      aggregateEnrollmentsWidgetQueries(TENANT, [
        { id: "bad", operation: "count", filterField: "not_a_field", filterValue: "x" },
      ] as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("computes class fill, seat demand and trailing retention", async () => {
    const report = await loadEnrollmentsReportAggregatesSql(TENANT);
    const importClass = report.classFillRates?.find((row) => row.classId === "cls-import");
    expect(importClass).toMatchObject({ capacity: 10, enrolled: 1, fillPct: 10, seatsLeft: 9 });
    expect(importClass?.demand).toBeGreaterThanOrEqual(0);
    expect(report.retention?.started).toBeGreaterThan(0);
    expect(report.retention?.retentionPct).toBeGreaterThanOrEqual(0);
    expect(report.retention?.retentionPct).toBeLessThanOrEqual(100);
  });
});
