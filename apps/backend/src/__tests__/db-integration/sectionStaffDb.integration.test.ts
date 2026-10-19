import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema, type Enrollment, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  contacts,
  faculty,
  facultyEmployments,
  students,
  tenantUsers,
  workspaces,
} from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import {
  assignSectionStaff,
  endSectionStaff,
  listSectionStaff,
} from "../../db/repositories/sectionStaffRepository.js";
import { saveEnrollment } from "../../db/repositories/enrollmentRepositoryPersist.js";
import { assertTeacherClassScope } from "../../sessions/use-cases/teacherSectionScope.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "section-staff-test";
const teacherUser = { id: "u-teacher", role: "teacher" } as User;

function enrollment(overrides: Partial<Enrollment>): Enrollment {
  return {
    id: "enr-1",
    studentId: "stu-1",
    studentName: "Student",
    sessionId: "ses-sec",
    sessionName: "S",
    classId: "cls-sec",
    className: "C",
    enrolledDate: "2026-01-02",
    baseFee: 0,
    discountType: "none",
    discountLabel: "",
    discountPct: 0,
    discountAmt: 0,
    finalFee: 0,
    status: "confirmed",
    paymentStatus: "none",
    notes: "",
    ...overrides,
  } as Enrollment;
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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Sections test", enabled: true });
    await tx.insert(tenantUsers).values({
      id: "u-teacher",
      workspaceSubdomain: TENANT,
      loginEmail: "t@test.dev",
      passwordHash: "x",
    });
    await tx.insert(contacts).values(
      [1, 2].map((i) => ({
        id: `c${i}`,
        workspaceSubdomain: TENANT,
        firstName: `Teacher ${i}`,
        name: `Teacher ${i}`,
      })),
    );
    await tx.insert(facultyEmployments).values(
      [1, 2].map((i) => ({
        id: `emp${i}`,
        workspaceSubdomain: TENANT,
        contactId: `c${i}`,
        status: "active",
      })),
    );
    await tx.insert(faculty).values([
      { id: "f1", workspaceSubdomain: TENANT, employmentId: "emp1", userId: "u-teacher" },
      { id: "f2", workspaceSubdomain: TENANT, employmentId: "emp2" },
    ]);
    await tx
      .insert(students)
      .values({ id: "stu-1", workspaceSubdomain: TENANT, grNumber: "gr-sec-1", status: "active" });
  });
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "ses-sec",
      name: "Sections",
      startDate: "2026-01-01",
      classes: [
        {
          id: "cls-sec",
          name: "Darja 1",
          sections: [
            { id: "sec-a", name: "A", capacity: 10 },
            { id: "sec-b", name: "B", capacity: 15 },
          ],
        },
      ],
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

describe("sections and section staff (real Postgres)", () => {
  it("given sections on a class, should persist them and derive class capacity when the session is read", async () => {
    // Arrange / Act
    const session = await withTenant(TENANT, () => findSessionById(TENANT, "ses-sec"));

    // Assert
    const cls = session?.classes[0];
    expect(cls?.sections?.map((s) => s.name)).toEqual(["A", "B"]);
    expect(cls?.maxStudents).toBe(25);
  });

  it("given a class teacher change, should close the old assignment the day before and keep history", async () => {
    // Arrange
    await assignSectionStaff(
      TENANT,
      "sec-a",
      { facultyId: "f1", role: "class_teacher", startOn: "2026-01-01" },
      "admin",
    );

    // Act
    await assignSectionStaff(
      TENANT,
      "sec-a",
      { facultyId: "f2", role: "class_teacher", startOn: "2026-03-01", reason: "Transfer" },
      "admin",
    );
    const history = await listSectionStaff(TENANT, "sec-a");
    const backdated = await assignSectionStaff(
      TENANT,
      "sec-a",
      { facultyId: "f1", role: "class_teacher", startOn: "2026-02-01" },
      "admin",
    ).catch((error: unknown) => error);

    // Assert
    expect(history.map((a) => [a.facultyId, a.startOn, a.endOn])).toEqual([
      ["f2", "2026-03-01", null],
      ["f1", "2026-01-01", "2026-02-28"],
    ]);
    expect(history[0].facultyName).toBe("Teacher 2");
    expect(backdated).toMatchObject({ statusCode: 409 });
  });

  it("given multiple assistants, should allow concurrent holders but reject a duplicate assistant", async () => {
    // Arrange
    await assignSectionStaff(
      TENANT,
      "sec-b",
      { facultyId: "f1", role: "assistant", startOn: "2026-01-01" },
      "admin",
    );

    // Act
    await assignSectionStaff(
      TENANT,
      "sec-b",
      { facultyId: "f2", role: "assistant", startOn: "2026-01-01" },
      "admin",
    );
    const duplicate = await assignSectionStaff(
      TENANT,
      "sec-b",
      { facultyId: "f1", role: "assistant", startOn: "2026-01-05" },
      "admin",
    ).catch((error: unknown) => error);

    // Assert
    const assistants = (await listSectionStaff(TENANT, "sec-b")).filter(
      (a) => a.role === "assistant" && a.endOn === null,
    );
    expect(assistants).toHaveLength(2);
    expect(duplicate).toMatchObject({ statusCode: 409 });
  });

  it("given a scoped teacher, should allow dates they teach and forbid dates after their assignment ended", async () => {
    // Arrange
    const [assistant] = (await listSectionStaff(TENANT, "sec-b")).filter(
      (a) => a.facultyId === "f1",
    );
    await endSectionStaff(TENANT, "sec-b", assistant.id, { endOn: "2026-01-31" }, "admin");

    // Act
    const allowed = await assertTeacherClassScope(teacherUser, TENANT, [
      { classId: "cls-sec", date: "2026-01-15" },
    ]).then(() => "ok");
    const denied = await assertTeacherClassScope(teacherUser, TENANT, [
      { classId: "cls-sec", date: "2026-03-15" },
    ]).catch((error: unknown) => error);

    // Assert
    expect(allowed).toBe("ok");
    expect(denied).toMatchObject({ statusCode: 403 });
  });

  it("given enrollments, should default to the first section, validate section membership and enforce roll uniqueness", async () => {
    // Arrange
    await saveEnrollment(TENANT, enrollment({ id: "enr-1", rollNo: "7" }));

    // Act
    const wrongSection = await saveEnrollment(
      TENANT,
      enrollment({ id: "enr-2", sectionId: "nope" }),
    ).catch((error: unknown) => error);
    const dupRoll = await saveEnrollment(
      TENANT,
      enrollment({ id: "enr-3", sectionId: "sec-a", rollNo: " 7 " }),
    ).catch((error: unknown) => error);
    const session = await withTenant(TENANT, () => findSessionById(TENANT, "ses-sec"));
    const removeEnrolled = await saveSession(
      TENANT,
      SessionSchema.parse({
        id: "ses-sec",
        name: "Sections",
        startDate: "2026-01-01",
        classes: [
          { id: "cls-sec", name: "Darja 1", sections: [{ id: "sec-b", name: "B", capacity: 15 }] },
        ],
      }),
    ).catch((error: unknown) => error);

    // Assert
    expect(wrongSection).toMatchObject({ statusCode: 400 });
    expect(dupRoll).toMatchObject({ statusCode: 409 });
    expect(session?.classes[0]?.sections?.find((s) => s.id === "sec-a")?.enrolled).toBe(1);
    expect(removeEnrolled).toMatchObject({ statusCode: 409 });
  });
});
