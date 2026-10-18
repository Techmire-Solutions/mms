import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { SessionSchema, type User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { enrollments, students, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { registrationLinkUseCases } from "../../sessions/use-cases/registrationLinkUseCases.js";
import {
  submitPublicRegistration,
  viewPublicRegistration,
} from "../../enrollments/use-cases/registrationPublicUseCases.js";
import { admissionsUseCases } from "../../enrollments/use-cases/admissionsUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "registration-test";
const ADMIN = {
  id: "admin-1",
  role: "admin",
  workspaceSubdomain: TENANT,
} as const satisfies Partial<User>;

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function applicant(overrides: Record<string, string> = {}) {
  return {
    classId: "rg-cls",
    fullName: "Ahmed Raza",
    guardianName: "Raza Khan",
    dateOfBirth: "2018-05-10",
    gender: "male" as const,
    phone: "+92 300 1234567",
    ...overrides,
  };
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
      madrasaName: "Registration Madrasa",
      enabled: true,
    }),
  );
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: "rg-ses",
      name: "Hifz 2027",
      status: "open",
      startDate: "2027-04-01",
      baseFee: 500,
      classes: [
        {
          id: "rg-cls",
          name: "Darja 1",
          gender: "male",
          minAge: 6,
          maxAge: 12,
          sections: [{ id: "rg-sec", name: "A", capacity: 30 }],
        },
      ],
    }),
  );
  const link = await runWithTenant(TENANT, () =>
    registrationLinkUseCases.save(
      TENANT,
      "rg-ses",
      "rg-link",
      { requiresReview: true, classIds: ["rg-cls"] },
      "admin-1",
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

describe("public registration → admissions (real Postgres)", () => {
  it("given a link, should expose only public data with an unguessable slug", async () => {
    // Act
    const view = await viewPublicRegistration(TENANT, slug);

    // Assert
    expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(view).toMatchObject({
      madrasaName: "Registration Madrasa",
      sessionName: "Hifz 2027",
      acceptingSubmissions: true,
    });
    expect(view.classes).toEqual([
      {
        id: "rg-cls",
        name: "Darja 1",
        gender: "male",
        minAge: 6,
        maxAge: 12,
        ageCalculationDate: "2027-04-01",
        seatsLeft: 30,
      },
    ]);
  });

  it("given eligible, ineligible and duplicate submissions, should store, reject 422 and reject 409", async () => {
    // Act
    const ok = await submitPublicRegistration(TENANT, slug, applicant(), "ip-hash");
    const tooYoung = submitPublicRegistration(
      TENANT,
      slug,
      applicant({ fullName: "Small Child", dateOfBirth: "2024-01-01" }),
      null,
    );
    const duplicate = submitPublicRegistration(TENANT, slug, applicant(), null);

    // Assert
    expect(ok).toMatchObject({
      reference: expect.stringMatching(/^APP-[A-Z0-9]{8}$/),
      status: "submitted",
    });
    await expect(tooYoung).rejects.toMatchObject({
      statusCode: 422,
      type: "registration_ineligible",
      message: "age_below",
    });
    await expect(duplicate).rejects.toMatchObject({ statusCode: 409 });
  });

  it("given reviewer decisions, should require a reject reason and approve into a student + enrollment", async () => {
    // Arrange
    const { items } = await admissionsUseCases.list(TENANT, { sessionId: "rg-ses" });
    const app = items[0];

    // Act
    const rejectWithoutReason = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [app.id], decision: "reject" }, ADMIN as User),
    ).then(
      () => "accepted",
      (error: unknown) => (error instanceof Error ? error.name : "error"),
    );
    const approved = await runWithTenant(TENANT, () =>
      admissionsUseCases.review(TENANT, { ids: [app.id], decision: "approve" }, ADMIN as User),
    );
    const after = await admissionsUseCases.list(TENANT, { sessionId: "rg-ses" });
    const metrics = await admissionsUseCases.metrics(TENANT, "rg-ses");
    const enrolled = await withTenant(TENANT, (tx) =>
      tx
        .select({ sectionId: enrollments.sectionId })
        .from(enrollments)
        .where(and(eq(enrollments.workspaceSubdomain, TENANT), eq(enrollments.classId, "rg-cls"))),
    );
    const created = await withTenant(TENANT, (tx) =>
      tx
        .select({ contactId: students.contactId })
        .from(students)
        .where(eq(students.workspaceSubdomain, TENANT)),
    );

    // Assert
    expect(rejectWithoutReason).toBe("ZodError");
    expect(approved).toEqual({ updated: 1, failures: [] });
    expect(after.items[0]).toMatchObject({
      status: "approved",
      studentId: expect.any(String),
      enrollmentId: expect.any(String),
      eligibilityReasons: [],
    });
    expect(metrics).toMatchObject({ submitted: 1, approved: 1, enrolled: 1 });
    expect(enrolled).toEqual([{ sectionId: "rg-sec" }]);
    expect(created).toEqual([{ contactId: expect.any(String) }]);
  });
});
