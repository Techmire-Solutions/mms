import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "workshops-test";
const inTenant = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

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
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Workshops test", enabled: true });
    await tx.insert(contacts).values(
      ["c1", "c2", "c3"].map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        firstName: id.toUpperCase(),
        name: `Contact ${id.toUpperCase()}`,
      })),
    );
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("workshops module (real Postgres)", () => {
  it("given a capacity of two, should register two contacts and refuse the third and a duplicate", async () => {
    // Arrange
    const workshop = await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "ws-cap",
        title: "Calligraphy",
        description: "",
        startDate: "2099-03-01",
        endDate: "2099-03-02",
        capacity: 2,
        fee: 1500,
      }),
    );

    // Act
    await inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c1"));
    await inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c2"));

    // Assert
    await expect(
      inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c1")),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c3")),
    ).rejects.toThrow("This workshop is full");
    const detail = await inTenant(() => workshopsUseCases.getWorkshop(workshop.id));
    expect(detail.workshop).toMatchObject({
      participantCount: 2,
      fee: 1500,
      startDate: "2099-03-01",
    });
    expect(detail.participants.map((p) => p.contactName)).toEqual(["Contact C1", "Contact C2"]);
  });

  it("given a past registration deadline, should refuse new participants", async () => {
    // Arrange
    const workshop = await inTenant(() =>
      workshopsUseCases.createWorkshop({
        title: "Closed",
        description: "",
        startDate: "2000-01-10",
        registrationDeadline: "2000-01-05",
      }),
    );

    // Act / Assert
    await expect(
      inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c1")),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given check-ins and scores, should upsert by key and reject days outside the workshop", async () => {
    // Arrange
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"));
    const [first, second] = detail.participants;
    const marks = (status: "present" | "absent") => ({
      dayOn: "2099-03-01",
      marks: [
        { participantId: first!.id, status },
        { participantId: second!.id, status: "present" as const },
      ],
    });

    // Act
    await inTenant(() => workshopsUseCases.saveAttendanceDay("ws-cap", marks("absent"), null));
    const attendance = await inTenant(() =>
      workshopsUseCases.saveAttendanceDay("ws-cap", marks("present"), null),
    );
    await inTenant(() =>
      workshopsUseCases.saveScores("ws-cap", {
        scores: [{ participantId: first!.id, criterionName: "Practical", score: 7, maxScore: 10 }],
      }),
    );
    const scores = await inTenant(() =>
      workshopsUseCases.saveScores("ws-cap", {
        scores: [{ participantId: first!.id, criterionName: "Practical", score: 9, maxScore: 10 }],
      }),
    );

    // Assert
    expect(attendance).toHaveLength(2);
    expect(attendance.every((mark) => mark.status === "present")).toBe(true);
    expect(scores).toEqual([
      expect.objectContaining({ criterionName: "Practical", score: 9, maxScore: 10 }),
    ]);
    await expect(
      inTenant(() =>
        workshopsUseCases.saveAttendanceDay(
          "ws-cap",
          { ...marks("present"), dayOn: "2099-03-05" },
          null,
        ),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      inTenant(() =>
        workshopsUseCases.saveAttendanceDay(
          "ws-cap",
          {
            dayOn: "2099-03-01",
            marks: [{ participantId: "not-a-participant", status: "present" }],
          },
          null,
        ),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given an update that ends before the stored start, should reject it", async () => {
    await expect(
      inTenant(() => workshopsUseCases.updateWorkshop("ws-cap", { endDate: "2099-02-01" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given a soft delete, should move the workshop to trash and restore it", async () => {
    // Act
    await inTenant(() => workshopsUseCases.deleteWorkshops(["ws-cap"], null, null));
    const active = await inTenant(() => workshopsUseCases.listWorkshops({}));
    const trash = await inTenant(() => workshopsUseCases.listWorkshops({ includeDeleted: true }));

    // Assert
    expect(active.workshops.map((w) => w.id)).not.toContain("ws-cap");
    expect(trash.workshops.map((w) => w.id)).toContain("ws-cap");
    await expect(
      inTenant(() => workshopsUseCases.addParticipant("ws-cap", "c3")),
    ).rejects.toBeInstanceOf(NotFoundError);
    await inTenant(() => workshopsUseCases.restoreWorkshop("ws-cap", null));
    expect(
      (await inTenant(() => workshopsUseCases.listWorkshops({}))).workshops.map((w) => w.id),
    ).toContain("ws-cap");
  });

  it("given upcoming and finished workshops, should count them and active participants", async () => {
    // Act
    const metrics = await inTenant(() => workshopsUseCases.loadMetrics());

    // Assert
    expect(metrics).toMatchObject({
      total: 2,
      upcoming: 1,
      finished: 1,
      ongoing: 0,
      participants: 2,
    });
  });
});
