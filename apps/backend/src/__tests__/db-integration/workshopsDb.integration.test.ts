import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contactPhones, contacts, programs, workshopEvents, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { pgErrorCode } from "../../lib/pgErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { guardContactSoftDeleteDependents } from "../../db/repositories/studentDeleteGuard.js";
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
    await tx.insert(contactPhones).values([
      {
        id: "ph-c1",
        workspaceSubdomain: TENANT,
        contactId: "c1",
        number: "+92 300 1111111",
        isPrimary: true,
      },
      // No primary: the lateral join must fall back to the lowest sort order.
      {
        id: "ph-c2-late",
        workspaceSubdomain: TENANT,
        contactId: "c2",
        number: "2222",
        sortOrder: 2,
      },
      {
        id: "ph-c2-first",
        workspaceSubdomain: TENANT,
        contactId: "c2",
        number: "0000",
        sortOrder: 0,
      },
    ]);
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
    // Lateral primary-phone projection: primary first, lowest sort order as the fallback.
    expect(detail.participants.map((p) => p.contactPhone)).toEqual(["+92 300 1111111", "0000"]);
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

    // Act / Assert — the lifecycle gate reports a conflict (the workshop is not open for intake).
    await expect(
      inTenant(() => workshopsUseCases.addParticipant(workshop.id, "c1")),
    ).rejects.toMatchObject({ type: "deadline_passed" });
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

  it("given an update that ends before the stored start, should reject it inside the write transaction", async () => {
    await expect(
      inTenant(() => workshopsUseCases.updateWorkshop("ws-cap", { endDate: "2099-02-01" })),
    ).rejects.toMatchObject({ statusCode: 400 });
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

  it("given a participant marked twice in one payload, should keep the last mark instead of failing", async () => {
    // Arrange
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"));
    const [first, second] = detail.participants;

    // Act — a repeated participant used to raise 21000 (a 500) inside the multi-row upsert.
    const attendance = await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "ws-cap",
        {
          dayOn: "2099-03-02",
          marks: [
            { participantId: first!.id, status: "absent" },
            { participantId: second!.id, status: "present" },
            { participantId: first!.id, status: "late" },
          ],
        },
        null,
      ),
    );

    // Assert — one row per participant for the day, last mark wins.
    const dayTwo = attendance.filter((mark) => mark.dayOn === "2099-03-02");
    expect(dayTwo).toHaveLength(2);
    expect(dayTwo.find((mark) => mark.participantId === first!.id)?.status).toBe("late");
    expect(dayTwo.find((mark) => mark.participantId === second!.id)?.status).toBe("present");
  });

  it("given a repeated (participant, criterion) score line, should keep the last line instead of failing", async () => {
    // Arrange
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"));
    const first = detail.participants[0]!;

    // Act
    const scores = await inTenant(() =>
      workshopsUseCases.saveScores("ws-cap", {
        scores: [
          { participantId: first.id, criterionName: "Duplicate", score: 3, maxScore: 10 },
          { participantId: first.id, criterionName: "Duplicate", score: 9, maxScore: 10 },
        ],
      }),
    );

    // Assert
    const duplicate = scores.filter((line) => line.criterionName === "Duplicate");
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]?.score).toBe(9);
  });

  it("given a withdrawn participant, should hide their check-ins and scores from the workshop detail", async () => {
    // Arrange
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"));
    const withdrawn = detail.participants.find((participant) => participant.contactId === "c2")!;
    expect(detail.attendance.some((mark) => mark.participantId === withdrawn.id)).toBe(true);

    // Act
    await inTenant(() => workshopsUseCases.removeParticipant("ws-cap", withdrawn.id, "u-admin"));
    const afterWithdraw = await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"));

    // Assert — the registration is archived, its history stays in the table but leaves the payload.
    expect(afterWithdraw.participants.map((participant) => participant.id)).not.toContain(
      withdrawn.id,
    );
    expect(afterWithdraw.attendance.some((mark) => mark.participantId === withdrawn.id)).toBe(
      false,
    );
    expect(afterWithdraw.scores.some((line) => line.participantId === withdrawn.id)).toBe(false);

    // Restore the seat so the capacity assertions below keep their fixture shape.
    await inTenant(() => workshopsUseCases.addParticipant("ws-cap", "c2"));
    expect(
      (await inTenant(() => workshopsUseCases.getWorkshop("ws-cap"))).participants,
    ).toHaveLength(2);
  });

  it("given a capacity below the active registrations, should refuse the change with a conflict", async () => {
    // Act / Assert — lowering the cap under the seats already taken would over-subscribe silently.
    await expect(
      inTenant(() => workshopsUseCases.updateWorkshop("ws-cap", { capacity: 1 })),
    ).rejects.toBeInstanceOf(ConflictError);

    const raised = await inTenant(() =>
      workshopsUseCases.updateWorkshop("ws-cap", { capacity: 5 }),
    );
    expect(raised?.capacity).toBe(5);
    const restored = await inTenant(() =>
      workshopsUseCases.updateWorkshop("ws-cap", { capacity: 2 }),
    );
    expect(restored?.capacity).toBe(2);
  });

  it("given an archived program, should refuse to link it to a workshop", async () => {
    // Arrange
    await withTenant(TENANT, async (tx) => {
      await tx.insert(programs).values({
        id: "prog-archived",
        workspaceSubdomain: TENANT,
        name: "Archived program",
        status: "archived",
        deletedAt: new Date(),
      });
    });

    // Act / Assert — the FK is ON DELETE RESTRICT, but soft-delete is an UPDATE, so the write path
    // has to guard the logical lifecycle itself (mms-data-layer §6.8).
    await expect(
      inTenant(() =>
        workshopsUseCases.createWorkshop({
          title: "Archived program workshop",
          description: "",
          startDate: "2099-04-01",
          programId: "prog-archived",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given a deadline after the last workshop day, should reject it at the database layer too", async () => {
    // Act / Assert — the API schema already rejects this; the CHECK is the direct-SQL/import guard.
    let thrown: unknown;
    try {
      await withTenant(TENANT, (tx) =>
        tx.insert(workshopEvents).values({
          id: "ws-deadline-check",
          workspaceSubdomain: TENANT,
          title: "Bad deadline",
          startDate: "2099-06-01",
          endDate: "2099-06-02",
          registrationDeadline: "2099-06-09",
        }),
      );
    } catch (error) {
      thrown = error;
    }
    expect(pgErrorCode(thrown)).toBe("23514");
  });

  it("given an active program, should link it and refuse once it is archived", async () => {
    // Arrange
    await withTenant(TENANT, (tx) =>
      tx.insert(programs).values({
        id: "prog-active",
        workspaceSubdomain: TENANT,
        name: "Active program",
        status: "active",
      }),
    );
    const created = await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "ws-program",
        title: "Program workshop",
        description: "",
        startDate: "2099-07-01",
        programId: "prog-active",
      }),
    );
    expect(created.programId).toBe("prog-active");

    // Act — archive the catalog row, then try to switch a workshop onto it.
    await withTenant(TENANT, (tx) =>
      tx.update(programs).set({ deletedAt: new Date() }).where(eq(programs.id, "prog-active")),
    );

    // Assert
    await expect(
      inTenant(() =>
        workshopsUseCases.createWorkshop({
          title: "Late program workshop",
          description: "",
          startDate: "2099-07-02",
          programId: "prog-active",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      inTenant(() => workshopsUseCases.updateWorkshop("ws-program", { programId: "prog-active" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given a contact registered for an active workshop, should block archiving the contact", async () => {
    // Act / Assert — Restrict Guard (soft-delete §2.2 policy A): the seat is owned by the
    // registration, so the contact cannot be archived out from under it.
    await expect(guardContactSoftDeleteDependents(TENANT, ["c1"])).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(guardContactSoftDeleteDependents(TENANT, ["c3"])).resolves.toBeUndefined();
  });
});
