import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "workshops-completion-test";
const inTenant = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

let amina = "";
let bilal = "";

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Completion test", enabled: true });
    await tx.insert(contacts).values([
      { id: "a", workspaceSubdomain: TENANT, firstName: "Amina", name: "Amina Khan" },
      { id: "b", workspaceSubdomain: TENANT, firstName: "Bilal", name: "Bilal Ahmed" },
    ]);
  });
  // A finished two-day workshop: both days count. 50% attendance and 60% score are required.
  await inTenant(() =>
    workshopsUseCases.createWorkshop({
      id: "done",
      title: "Calligraphy",
      description: "",
      startDate: "2000-01-10",
      endDate: "2000-01-11",
      minAttendancePct: 50,
      minScorePct: 60,
    }),
  );
  const a = await inTenant(() => workshopsUseCases.addParticipant("done", "a"));
  const b = await inTenant(() => workshopsUseCases.addParticipant("done", "b"));
  amina = a.id;
  bilal = b.id;
  await inTenant(() =>
    workshopsUseCases.saveAttendanceDay(
      "done",
      {
        dayOn: "2000-01-10",
        marks: [
          { participantId: amina, status: "present" },
          { participantId: bilal, status: "late" },
        ],
      },
      null,
    ),
  );
  await inTenant(() =>
    workshopsUseCases.saveAttendanceDay(
      "done",
      { dayOn: "2000-01-11", marks: [{ participantId: amina, status: "present" }] },
      null,
    ),
  );
  await inTenant(() =>
    workshopsUseCases.saveScores("done", {
      scores: [
        { participantId: amina, criterionName: "Practical", score: 8, maxScore: 10 },
        { participantId: bilal, criterionName: "Practical", score: 5, maxScore: 10 },
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

describe("workshop completion and certificates (real Postgres)", () => {
  it("given attendance and scores, should evaluate each participant against the criteria", async () => {
    // Act
    const rows = await inTenant(() => workshopsCompletionUseCases.evaluateCompletion("done"));

    // Assert
    const byName = Object.fromEntries(rows.map((row) => [row.contactName, row]));
    expect(byName["Amina Khan"]).toMatchObject({
      status: "completed",
      attendancePct: 100,
      scorePct: 80,
      shortfalls: [],
    });
    expect(byName["Amina Khan"]?.completedAt).not.toBeNull();
    expect(byName["Bilal Ahmed"]).toMatchObject({
      status: "attended",
      attendancePct: 50,
      scorePct: 50,
      shortfalls: ["score_below"],
      completedAt: null,
    });
  });

  it("given an issue-all request, should certify only completed participants, once", async () => {
    // Act
    const first = await inTenant(() =>
      workshopsCompletionUseCases.issueCertificates("done", { participantIds: [] }),
    );
    const again = await inTenant(() =>
      workshopsCompletionUseCases.issueCertificates("done", { participantIds: [] }),
    );

    // Assert
    expect(first.issued).toEqual([amina]);
    expect(again.issued).toEqual([]);
    expect(first.rows.find((row) => row.participantId === bilal)?.certificateIssuedAt).toBeNull();
  });

  it("given a re-evaluation that no longer completes, should keep the issued certificate's date", async () => {
    // Arrange: Amina's score drops below the minimum
    await inTenant(() =>
      workshopsUseCases.saveScores("done", {
        scores: [{ participantId: amina, criterionName: "Practical", score: 2, maxScore: 10 }],
      }),
    );

    // Act
    const rows = await inTenant(() => workshopsCompletionUseCases.evaluateCompletion("done"));

    // Assert
    const row = rows.find((r) => r.participantId === amina);
    expect(row?.status).toBe("attended");
    expect(row?.certificateIssuedAt).not.toBeNull();
    expect(row?.completedAt).not.toBeNull();
  });

  it("given the report, should summarise attendance and completion per workshop", async () => {
    // Act
    const report = await inTenant(() => workshopsCompletionUseCases.getReport());

    // Assert — 3 present/late marks out of 2 participants × 2 days
    expect(report).toEqual([
      expect.objectContaining({
        workshopId: "done",
        participants: 2,
        attendancePct: 75,
        completed: 0,
        certificates: 1,
      }),
    ]);
  });

  it("given Setup defaults, should save and read them back", async () => {
    // Act
    const saved = await inTenant(() =>
      workshopsCompletionUseCases.savePreferences({
        defaultMinAttendancePct: 80,
        defaultMinScorePct: null,
      }),
    );

    // Assert
    expect(saved).toEqual({ defaultMinAttendancePct: 80, defaultMinScorePct: null });
    expect(await inTenant(() => workshopsCompletionUseCases.getPreferences())).toEqual(saved);
  });
});
