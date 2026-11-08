import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  enrollmentPlacements,
  enrollments,
  registrationApplications,
  sessionClassSections,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { saveEnrollment } from "../../db/repositories/enrollmentRepositoryPersist.js";
import { applyEnrollmentTransfer } from "../../db/repositories/enrollmentOperationsRepository.js";
import { flagOldestWaitlistedApplication } from "../../db/repositories/registrationWaitlistRepository.js";
import { bulkEnrollStudentsIntoClass } from "../../enrollments/use-cases/enrollmentBulkEnroll.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

const TENANT = uniqueTenant("enr-concurrency-test");
const SESSION = "ses-conc";
const CLASS = "cls-conc";
const STUDENT_IDS = Array.from({ length: 24 }, (_, index) => `sc-${index + 1}`);
/** Reserved for the non-N-way cases so earlier winners cannot pre-enroll them. */
const RESERVED_STUDENT_IDS = ["sp-1", "sp-2", "sp-3", "sp-4", "sp-5", "sp-6", "sp-7"];

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function enrollmentRecord(id: string, studentId: string, sectionId: string, rollNo?: string) {
  return {
    id,
    studentId,
    studentName: studentId,
    sessionId: SESSION,
    sessionName: "Concurrency session",
    classId: CLASS,
    className: "Concurrency class",
    sectionId,
    ...(rollNo ? { rollNo } : {}),
    enrolledDate: "2026-01-01",
    baseFee: 0,
    discountType: "none",
    discountLabel: "",
    discountPct: 0,
    discountAmt: 0,
    finalFee: 0,
    status: "pending" as const,
    invoiceId: null,
    paymentStatus: "none" as const,
    notes: "",
    timeline: [],
  };
}

async function addSection(id: string, capacity: number): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx.insert(sessionClassSections).values({
      id: `${id}-${crypto.randomUUID().slice(0, 6)}`,
      workspaceSubdomain: TENANT,
      sessionId: SESSION,
      classId: CLASS,
      name: id,
      capacity,
    }),
  );
}

async function sectionIdOf(id: string): Promise<string> {
  const [row] = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: sessionClassSections.id })
      .from(sessionClassSections)
      .where(
        and(eq(sessionClassSections.workspaceSubdomain, TENANT), eq(sessionClassSections.name, id)),
      ),
  );
  return row!.id;
}

async function sectionSeatCount(sectionId: string): Promise<number> {
  const [row] = await withTenant(TENANT, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, TENANT),
          eq(enrollments.sectionId, sectionId),
          isNull(enrollments.deletedAt),
        ),
      ),
  );
  return Number(row?.count ?? 0);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: `ws-${TENANT}`,
      subdomain: TENANT,
      madrasaName: "Concurrency",
      enabled: true,
    });
    await tx.insert(students).values(
      [...STUDENT_IDS, ...RESERVED_STUDENT_IDS].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        grNumber: `gr-${id}`,
        status: "active",
      })),
    );
    await tx.insert(sessions).values({
      id: SESSION,
      workspaceSubdomain: TENANT,
      name: "Concurrency session",
    });
    await tx.insert(sessionClasses).values({
      id: CLASS,
      workspaceSubdomain: TENANT,
      sessionId: SESSION,
      name: "Concurrency class",
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

describe("enrollment concurrency invariants (real Postgres)", () => {
  it("never over-fills a final seat under an N-way race (repeated)", async () => {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const label = `race-${iteration}-${crypto.randomUUID().slice(0, 6)}`;
      await addSection(label, 3);
      const sectionId = await sectionIdOf(label);
      const studentsInRace = STUDENT_IDS.slice(iteration * 8, iteration * 8 + 8);

      const outcomes = await Promise.allSettled(
        studentsInRace.map((studentId) =>
          saveEnrollment(
            TENANT,
            enrollmentRecord(`enr-${label}-${studentId}`, studentId, sectionId),
          ),
        ),
      );
      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
      expect(fulfilled, label).toHaveLength(3);
      expect(rejected, label).toHaveLength(5);
      for (const outcome of rejected) {
        expect((outcome as PromiseRejectedResult).reason).toMatchObject({
          type: "class_full",
        });
      }
      expect(await sectionSeatCount(sectionId)).toBe(3);
    }
  });

  it("serializes a bulk write against a single write for the last seat", async () => {
    const label = `bulk-${crypto.randomUUID().slice(0, 6)}`;
    await addSection(label, 1);
    const sectionId = await sectionIdOf(label);
    const [bulkStudent, singleStudent] = ["sp-1", "sp-2"];

    const [bulk, single] = await Promise.allSettled([
      runWithTenant(TENANT, () =>
        bulkEnrollStudentsIntoClass(TENANT, {
          studentIds: [bulkStudent],
          sessionId: SESSION,
          classId: CLASS,
          sectionId,
          mode: "add",
        }),
      ),
      saveEnrollment(TENANT, enrollmentRecord(`enr-${label}-single`, singleStudent, sectionId)),
    ]);

    expect(await sectionSeatCount(sectionId)).toBe(1);
    const bulkWon = bulk.status === "fulfilled" && bulk.value.succeeded === 1;
    const singleWon = single.status === "fulfilled";
    expect(Number(bulkWon) + Number(singleWon)).toBe(1);
    if (!singleWon) {
      expect((single as PromiseRejectedResult).reason).toMatchObject({ type: "class_full" });
    }
    if (!bulkWon) {
      expect(bulk.status).toBe("fulfilled");
      expect((bulk as PromiseFulfilledResult<{ failed: number }>).value.failed).toBe(1);
    }
  });

  it("allows exactly one live enrollment per student under concurrent creates", async () => {
    const labelA = `dup-a-${crypto.randomUUID().slice(0, 6)}`;
    const labelB = `dup-b-${crypto.randomUUID().slice(0, 6)}`;
    await addSection(labelA, 5);
    await addSection(labelB, 5);
    const [sectionA, sectionB] = [await sectionIdOf(labelA), await sectionIdOf(labelB)];

    const outcomes = await Promise.allSettled([
      saveEnrollment(TENANT, enrollmentRecord(`enr-${labelA}`, "sp-3", sectionA)),
      saveEnrollment(TENANT, enrollmentRecord(`enr-${labelB}`, "sp-3", sectionB)),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejection = outcomes.find((outcome) => outcome.status === "rejected") as
      PromiseRejectedResult | undefined;
    expect(rejection?.reason).toMatchObject({ statusCode: 409, type: "already_enrolled" });

    const [count] = await withTenant(TENANT, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.workspaceSubdomain, TENANT),
            eq(enrollments.studentId, "sp-3"),
            isNull(enrollments.deletedAt),
          ),
        ),
    );
    expect(Number(count?.count ?? 0)).toBe(1);
  });

  it("allows exactly one holder of a roll number under a concurrent write", async () => {
    const label = `roll-${crypto.randomUUID().slice(0, 6)}`;
    await addSection(label, 5);
    const sectionId = await sectionIdOf(label);

    const outcomes = await Promise.allSettled([
      saveEnrollment(TENANT, enrollmentRecord(`enr-${label}-a`, "sp-4", sectionId, "R1")),
      saveEnrollment(TENANT, enrollmentRecord(`enr-${label}-b`, "sp-5", sectionId, "R1")),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejection = outcomes.find((outcome) => outcome.status === "rejected") as
      PromiseRejectedResult | undefined;
    expect(rejection?.reason).toMatchObject({ statusCode: 409, type: "roll_no_taken" });
  });

  it("serializes a transfer against a new enrollment for the same final seat", async () => {
    const sourceLabel = `src-${crypto.randomUUID().slice(0, 6)}`;
    const targetLabel = `tgt-${crypto.randomUUID().slice(0, 6)}`;
    await addSection(sourceLabel, 5);
    await addSection(targetLabel, 1);
    const [source, target] = [await sectionIdOf(sourceLabel), await sectionIdOf(targetLabel)];
    await saveEnrollment(TENANT, enrollmentRecord(`enr-${sourceLabel}`, "sp-6", source));

    const [transfer, single] = await Promise.allSettled([
      applyEnrollmentTransfer(TENANT, {
        enrollmentId: `enr-${sourceLabel}`,
        from: { classId: CLASS, sectionId: source },
        to: { classId: CLASS, className: "Concurrency class", sectionId: target },
        fee: {
          baseFee: 0,
          discountType: "none",
          discountLabel: "",
          discountPct: 0,
          discountAmt: 0,
          finalFee: 0,
        },
        effectiveOn: "2026-02-01",
        reason: "race transfer",
        actor: { userId: "u-admin", label: "Admin" },
      }),
      saveEnrollment(TENANT, enrollmentRecord(`enr-${targetLabel}`, "sp-7", target)),
    ]);

    expect(await sectionSeatCount(target)).toBe(1);
    const transferWon = transfer.status === "fulfilled";
    const singleWon = single.status === "fulfilled";
    expect(Number(transferWon) + Number(singleWon)).toBe(1);
    if (!transferWon) {
      expect((transfer as PromiseRejectedResult).reason).toMatchObject({ type: "class_full" });
    }
    if (!singleWon) {
      expect((single as PromiseRejectedResult).reason).toMatchObject({ type: "class_full" });
    }
    const [placements] = await withTenant(TENANT, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollmentPlacements)
        .where(eq(enrollmentPlacements.workspaceSubdomain, TENANT)),
    );
    expect(Number(placements?.count ?? 0)).toBeGreaterThan(0);
  });

  it("offers each waitlisted application at most once under concurrent claims", async () => {
    const linkId = `link-${crypto.randomUUID().slice(0, 6)}`;
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`
        INSERT INTO session_registration_links (id, workspace_subdomain, session_id, slug)
        VALUES (${linkId}, ${TENANT}, ${SESSION}, ${`slug-${linkId}`})`);
      await tx.insert(registrationApplications).values(
        ["a", "b"].map((suffix, index) => ({
          id: `app-${linkId}-${suffix}`,
          workspaceSubdomain: TENANT,
          reference: `REF-${linkId}-${suffix}`,
          linkId,
          sessionId: SESSION,
          classId: CLASS,
          fullName: `Waitlisted ${suffix}`,
          guardianName: "Guardian",
          dateOfBirth: "2015-01-01",
          gender: "male",
          phone: "03001234567",
          status: "waitlisted" as const,
          createdAt: new Date(Date.now() - (index + 1) * 60_000),
        })),
      );
    });

    const [first, second] = await Promise.all([
      flagOldestWaitlistedApplication(TENANT, CLASS, 72),
      flagOldestWaitlistedApplication(TENANT, CLASS, 72),
    ]);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.id).not.toBe(second!.id);
    const [offered] = await withTenant(TENANT, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(registrationApplications)
        .where(
          and(
            eq(registrationApplications.workspaceSubdomain, TENANT),
            eq(registrationApplications.classId, CLASS),
            eq(registrationApplications.status, "under_review"),
          ),
        ),
    );
    expect(Number(offered?.count ?? 0)).toBe(2);
  });
});
