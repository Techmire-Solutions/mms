import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workshopParticipants, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-eligibility-${randomUUID().slice(0, 8)}`;
const CONTACTS = ["el-1", "el-2", "el-3"];
const inTenant = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

async function purge(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Workshop eligibility",
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

async function createWorkshop(id: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: id,
      description: "",
      startDate: "2000-01-10",
      endDate: "2000-01-11",
      ...overrides,
    }),
  );
}

async function seedParticipant(id: string, workshopId: string, contactId: string): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx.insert(workshopParticipants).values({
      id,
      workspaceSubdomain: TENANT,
      workshopId,
      contactId,
      status: "registered",
    }),
  );
}

async function markPresent(
  workshopId: string,
  participantId: string,
  dayOn: string,
): Promise<void> {
  await inTenant(() =>
    workshopsUseCases.saveAttendanceDay(
      workshopId,
      { dayOn, marks: [{ participantId, status: "present" }] },
      "u-admin",
    ),
  );
}

describe("completion eligibility (real Postgres)", () => {
  it("re-evaluates at certificate issuance, so a stale completed standing cannot mint one", async () => {
    await createWorkshop("el-stale", { minScorePct: 60 });
    await seedParticipant("p-stale", "el-stale", CONTACTS[0]!);
    await markPresent("el-stale", "p-stale", "2000-01-10");
    await markPresent("el-stale", "p-stale", "2000-01-11");
    await inTenant(() =>
      workshopsUseCases.saveScores("el-stale", {
        scores: [{ participantId: "p-stale", criterionName: "Practical", score: 8, maxScore: 10 }],
      }),
    );
    const evaluated = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("el-stale"),
    );
    expect(evaluated.find((row) => row.participantId === "p-stale")?.status).toBe("completed");

    // The score is corrected downwards after the evaluation.
    await inTenant(() =>
      workshopsUseCases.saveScores("el-stale", {
        scores: [{ participantId: "p-stale", criterionName: "Practical", score: 2, maxScore: 10 }],
      }),
    );

    const issued = await inTenant(() =>
      workshopsCompletionUseCases.issueCertificates("el-stale", { participantIds: [] }),
    );

    expect(issued.issued).toEqual([]);
    expect(issued.rows.find((row) => row.participantId === "p-stale")?.status).toBe("attended");
  });

  it("certifies a participant who qualifies at issuance time without a separate Evaluate", async () => {
    await createWorkshop("el-late", { minAttendancePct: 100 });
    await seedParticipant("p-late", "el-late", CONTACTS[0]!);
    await markPresent("el-late", "p-late", "2000-01-10");
    // Evaluate while only half the workshop has been attended.
    const evaluated = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("el-late"),
    );
    expect(evaluated.find((row) => row.participantId === "p-late")?.status).toBe("attended");

    // A late check-in makes them eligible; issuance must see it without another Evaluate click.
    await markPresent("el-late", "p-late", "2000-01-11");
    const issued = await inTenant(() =>
      workshopsCompletionUseCases.issueCertificates("el-late", { participantIds: [] }),
    );

    expect(issued.issued).toEqual(["p-late"]);
  });

  it("counts only check-ins inside the current window after the dates are edited", async () => {
    await createWorkshop("el-window", { minAttendancePct: 100 });
    await seedParticipant("p-window", "el-window", CONTACTS[0]!);
    await markPresent("el-window", "p-window", "2000-01-10");
    await markPresent("el-window", "p-window", "2000-01-11");
    // Shrink the workshop to one day; the day-10 mark is now outside the window.
    await inTenant(() =>
      workshopsUseCases.updateWorkshop("el-window", {
        startDate: "2000-01-11",
        endDate: "2000-01-11",
      }),
    );

    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("el-window"));

    expect(rows[0]).toMatchObject({ attendancePct: 100, status: "completed" });
  });

  it("never completes a dateless workshop", async () => {
    await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "el-dateless",
        title: "el-dateless",
        description: "",
      }),
    );
    await inTenant(() => workshopsUseCases.addParticipant("el-dateless", CONTACTS[1]!));
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("el-dateless"));
    const participant = detail.participants[0]!;
    await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "el-dateless",
        { dayOn: "2026-03-01", marks: [{ participantId: participant.id, status: "present" }] },
        "u-admin",
      ),
    );

    const evaluated = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("el-dateless"),
    );
    // No schedule means no countable day, so the orphan check-in cannot establish attendance.
    expect(evaluated[0]).toMatchObject({
      status: "registered",
      attendancePct: null,
      shortfalls: expect.arrayContaining(["attendance_none", "attendance_unknown"]),
    });
    await expect(
      inTenant(() =>
        workshopsCompletionUseCases.issueCertificates("el-dateless", { participantIds: [] }),
      ),
    ).rejects.toMatchObject({ type: "workshop_not_finished" });
  });

  it("rejects a workshop that runs longer than the maximum span", async () => {
    await expect(
      inTenant(() =>
        workshopsUseCases.createWorkshop({
          id: "el-too-long",
          title: "el-too-long",
          description: "",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        }),
      ),
    ).rejects.toBeInstanceOf(HttpDomainError);
  });

  it("finalizes participant standings atomically when the workshop is completed", async () => {
    await createWorkshop("el-complete");
    await seedParticipant("p-complete", "el-complete", CONTACTS[2]!);
    await markPresent("el-complete", "p-complete", "2000-01-10");
    const current = await inTenant(() => workshopsUseCases.getWorkshop("el-complete"));

    await inTenant(() =>
      workshopsUseCases.transitionWorkshop(
        "el-complete",
        { to: "completed" },
        { id: "u-admin" },
        current.workshop.updatedAt,
      ),
    );

    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("el-complete"));
    expect(rows.find((row) => row.participantId === "p-complete")?.status).toBe("completed");
    const report = await inTenant(() => workshopsCompletionUseCases.getReport());
    expect(report.find((row) => row.workshopId === "el-complete")?.completed).toBe(1);
  });
});
