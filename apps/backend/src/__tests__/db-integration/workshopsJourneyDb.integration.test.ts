import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  contacts,
  workshopAttendance,
  workshopParticipants,
  workshopScores,
  workspaces,
} from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-journey-${randomUUID().slice(0, 8)}`;
const CONTACTS = ["j-1", "j-2", "j-3", "j-4"];
const inTenant = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

async function purge(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function createWorkshop(id: string, overrides: Record<string, unknown> = {}) {
  return inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: id,
      description: "",
      startDate: "2099-04-01",
      endDate: "2099-04-02",
      capacity: 10,
      ...overrides,
    }),
  );
}

async function complete(id: string) {
  const detail = await inTenant(() => workshopsUseCases.getWorkshop(id));
  return inTenant(() =>
    workshopsUseCases.transitionWorkshop(
      id,
      { to: "completed" },
      { id: "u-admin" },
      detail.workshop.updatedAt,
    ),
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Workshop journey",
      enabled: true,
    });
    await tx.insert(contacts).values(
      CONTACTS.map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        firstName: id,
        name: `Contact ${id}`,
      })),
    );
  });
});

afterAll(async () => {
  try {
    await purge();
  } finally {
    await closeDatabase();
  }
});

describe("workshop lifecycle journey (real Postgres)", () => {
  it("runs create → register → attendance/scores → evaluate → complete → certify → report", async () => {
    await createWorkshop("journey-flow");
    const [first, second] = await Promise.all([
      inTenant(() => workshopsUseCases.addParticipant("journey-flow", CONTACTS[0]!)),
      inTenant(() => workshopsUseCases.addParticipant("journey-flow", CONTACTS[1]!)),
    ]);

    // Rescheduling a future workshop into the past lets the same registrations be completed
    // without seeding participant rows directly (the public path correctly refuses ended ones).
    await inTenant(() =>
      workshopsUseCases.updateWorkshop("journey-flow", {
        startDate: "2000-01-01",
        endDate: "2000-01-02",
      }),
    );

    await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "journey-flow",
        {
          dayOn: "2000-01-01",
          marks: [
            { participantId: first.id, status: "present" },
            { participantId: second.id, status: "absent" },
          ],
        },
        null,
      ),
    );
    await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "journey-flow",
        {
          dayOn: "2000-01-02",
          marks: [{ participantId: first.id, status: "present" }],
        },
        null,
      ),
    );
    await inTenant(() =>
      workshopsUseCases.saveScores("journey-flow", {
        scores: [{ participantId: first.id, criterionName: "Practical", score: 8, maxScore: 10 }],
      }),
    );

    const before = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("journey-flow"),
    );
    expect(before.find((row) => row.participantId === first.id)).toMatchObject({
      status: "completed",
      attendancePct: 100,
    });
    expect(before.find((row) => row.participantId === second.id)?.status).toBe("registered");

    const completed = await complete("journey-flow");
    expect(completed.status).toBe("completed");

    const issued = await inTenant(() =>
      workshopsCompletionUseCases.issueCertificates("journey-flow", { participantIds: [] }),
    );
    expect(issued.issued).toEqual([first.id]);

    const report = (await inTenant(() => workshopsCompletionUseCases.getReport())).find(
      (row) => row.workshopId === "journey-flow",
    );
    expect(report).toMatchObject({
      participants: 2,
      completed: 1,
      certificates: 1,
      seatUtilizationPct: 20,
      completionPct: 50,
    });

    const metrics = await inTenant(() => workshopsUseCases.loadMetrics());
    expect(metrics.participants).toBe(2);

    await expect(
      inTenant(() => workshopsUseCases.removeParticipant("journey-flow", first.id, "u-admin")),
    ).rejects.toMatchObject({ type: "certificate_issued" });
    await expect(
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "journey-flow",
          { to: "cancelled", reason: "Too late" },
          { id: "u-admin" },
          completed.updatedAt,
        ),
      ),
    ).rejects.toMatchObject({ type: "illegal_workshop_transition" });
  });

  it("cancels a seated + waitlisted cohort atomically and leaves no live seat", async () => {
    await createWorkshop("journey-cancel", { capacity: 1, waitlistEnabled: true });
    const seated = await inTenant(() =>
      workshopsUseCases.addParticipant("journey-cancel", CONTACTS[0]!),
    );
    const queued = await inTenant(() =>
      workshopsUseCases.addParticipant("journey-cancel", CONTACTS[1]!),
    );
    expect(queued.waitlistedAt).not.toBeNull();
    await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "journey-cancel",
        { dayOn: "2099-04-01", marks: [{ participantId: seated.id, status: "present" }] },
        null,
      ),
    );
    await inTenant(() =>
      workshopsUseCases.saveScores("journey-cancel", {
        scores: [{ participantId: seated.id, criterionName: "Practical", score: 5, maxScore: 10 }],
      }),
    );

    const detail = await inTenant(() => workshopsUseCases.getWorkshop("journey-cancel"));
    await inTenant(() =>
      workshopsUseCases.transitionWorkshop(
        "journey-cancel",
        { to: "cancelled", reason: "Venue unavailable" },
        { id: "u-admin" },
        detail.workshop.updatedAt,
      ),
    );

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({
          id: workshopParticipants.id,
          deletedAt: workshopParticipants.deletedAt,
          cascade: workshopParticipants.deletedWithCascade,
          reason: workshopParticipants.deletionReason,
        })
        .from(workshopParticipants)
        .where(eq(workshopParticipants.workshopId, "journey-cancel")),
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.deletedAt).not.toBeNull();
      expect(row.cascade).toBe(true);
      expect(row.reason).toBe("Venue unavailable");
    }
    const after = await inTenant(() => workshopsUseCases.getWorkshop("journey-cancel"));
    expect(after.workshop.status).toBe("cancelled");
    expect(after.participants).toHaveLength(0);
    await expect(
      inTenant(() => workshopsUseCases.addParticipant("journey-cancel", CONTACTS[2]!)),
    ).rejects.toMatchObject({ type: "workshop_not_open" });
  });

  it("archives a workshop without deleting its roster/marks, then restores them", async () => {
    await createWorkshop("journey-archive");
    const participant = await inTenant(() =>
      workshopsUseCases.addParticipant("journey-archive", CONTACTS[2]!),
    );
    await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "journey-archive",
        { dayOn: "2099-04-01", marks: [{ participantId: participant.id, status: "present" }] },
        null,
      ),
    );
    await inTenant(() =>
      workshopsUseCases.saveScores("journey-archive", {
        scores: [
          { participantId: participant.id, criterionName: "Practical", score: 7, maxScore: 10 },
        ],
      }),
    );

    await inTenant(() =>
      workshopsUseCases.deleteWorkshops(["journey-archive"], "u-admin", "Cleanup"),
    );
    const active = await inTenant(() => workshopsUseCases.listWorkshops({}));
    const trash = await inTenant(() => workshopsUseCases.listWorkshops({ includeDeleted: true }));
    expect(active.workshops.map((row) => row.id)).not.toContain("journey-archive");
    expect(trash.workshops.map((row) => row.id)).toContain("journey-archive");
    // The detail read intentionally serves archived rows (restore/trash draws them); writes must
    // still fail closed.
    const archived = await inTenant(() => workshopsUseCases.getWorkshop("journey-archive"));
    expect(archived.workshop.deletedAt).not.toBeNull();
    await expect(
      inTenant(() => workshopsUseCases.addParticipant("journey-archive", CONTACTS[3]!)),
    ).rejects.toBeTruthy();

    // Soft-deleting the workshop must not soft-delete its evidence rows.
    const childState = await withTenant(TENANT, async (tx) => {
      const [participantRow] = await tx
        .select({ deletedAt: workshopParticipants.deletedAt })
        .from(workshopParticipants)
        .where(
          and(
            eq(workshopParticipants.workshopId, "journey-archive"),
            eq(workshopParticipants.id, participant.id),
          ),
        );
      const [attendanceRow] = await tx
        .select({ id: workshopAttendance.id })
        .from(workshopAttendance)
        .where(
          and(
            eq(workshopAttendance.workshopId, "journey-archive"),
            eq(workshopAttendance.participantId, participant.id),
          ),
        );
      const [scoreRow] = await tx
        .select({ id: workshopScores.id })
        .from(workshopScores)
        .where(
          and(
            eq(workshopScores.workshopId, "journey-archive"),
            eq(workshopScores.participantId, participant.id),
          ),
        );
      return { participantRow, attendanceRow, scoreRow };
    });
    expect(childState.participantRow?.deletedAt).toBeNull();
    expect(childState.attendanceRow).toBeDefined();
    expect(childState.scoreRow).toBeDefined();

    await inTenant(() => workshopsUseCases.restoreWorkshop("journey-archive", "u-admin"));
    const restored = await inTenant(() => workshopsUseCases.getWorkshop("journey-archive"));
    expect(restored.participants.map((row) => row.id)).toEqual([participant.id]);
    expect(restored.attendance).toHaveLength(1);
    expect(restored.scores).toHaveLength(1);
  });
});
