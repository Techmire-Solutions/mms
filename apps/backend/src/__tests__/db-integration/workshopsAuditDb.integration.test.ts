import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { auditTrailEvents, contacts, workshopParticipants, workspaces } from "../../db/schema.js";
import { bindRequestUserId, runWithTenant } from "../../lib/tenantContext.js";
import { decryptSubjectAuditState } from "../../lib/subjectKeyService.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-audit-${randomUUID().slice(0, 8)}`;
const CONTACTS = ["au-1", "au-2", "au-3"];

async function purge(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

/** Run a use case as an authenticated actor (the audit row reads the ALS user). */
const as = <T>(actor: string, fn: () => Promise<T>): Promise<T> =>
  runWithTenant(TENANT, () => {
    bindRequestUserId(actor);
    return fn();
  });

async function auditRows(tableName: string, recordId?: string) {
  return withTenantRead(TENANT, (tx) =>
    tx
      .select({
        tableName: auditTrailEvents.tableName,
        recordId: auditTrailEvents.recordId,
        actionType: auditTrailEvents.actionType,
        realUserId: auditTrailEvents.realUserId,
        oldState: auditTrailEvents.oldState,
        newState: auditTrailEvents.newState,
        hashPrevious: auditTrailEvents.hashPrevious,
        hashCurrent: auditTrailEvents.hashCurrent,
        at: auditTrailEvents.transactionTimestamp,
      })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.tableName, tableName),
          ...(recordId ? [eq(auditTrailEvents.recordId, recordId)] : []),
        ),
      )
      .orderBy(desc(auditTrailEvents.transactionTimestamp)),
  );
}

const state = async (value: string | null): Promise<Record<string, unknown>> => {
  const plain = await decryptSubjectAuditState(TENANT, value);
  return plain ? (JSON.parse(plain) as Record<string, unknown>) : {};
};

async function findAudit(rows: Awaited<ReturnType<typeof auditRows>>, operation: string) {
  for (const row of rows) {
    if ((await state(row.newState ?? null)).operation === operation) return row;
  }
  return undefined;
}

async function seedParticipant(workshopId: string, id: string, contactId: string): Promise<void> {
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

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Workshop audit",
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
  bindRequestUserId(null);
  try {
    await purge();
  } finally {
    await closeDatabase();
  }
});

describe("workshop audit coverage (real Postgres)", () => {
  it("logs workshop creation with the actor and the created state", async () => {
    await as("u-admin", () =>
      workshopsUseCases.createWorkshop({
        id: "au-live",
        title: "Audited workshop",
        description: "",
        startDate: "2099-03-01",
        endDate: "2099-03-02",
        capacity: 5,
      }),
    );
    const [row] = await auditRows("workshop_events", "au-live");
    expect(row).toMatchObject({
      actionType: "CREATE",
      realUserId: "u-admin",
    });
    expect(await state(row!.newState ?? null)).toMatchObject({ id: "au-live", capacity: 5 });
    expect(row!.hashCurrent).toHaveLength(64);
  });

  it("logs a capacity override with before/after and the actor", async () => {
    await as("u-principal", () => workshopsUseCases.updateWorkshop("au-live", { capacity: 9 }));
    const [row] = await auditRows("workshop_events", "au-live");
    expect(row).toMatchObject({ actionType: "UPDATE", realUserId: "u-principal" });
    const diff = JSON.stringify({
      old: await state(row!.oldState ?? null),
      next: await state(row!.newState ?? null),
    });
    expect(diff).toContain("capacity");
  });

  it("logs participant registration and withdrawal with before/after", async () => {
    const added = await as("u-teacher", () =>
      workshopsUseCases.addParticipant("au-live", CONTACTS[0]!),
    );
    const [created] = await auditRows("workshop_participants", added.id);
    expect(created).toMatchObject({ actionType: "CREATE", realUserId: "u-teacher" });
    expect(await state(created!.newState ?? null)).toMatchObject({ contactId: CONTACTS[0] });

    await as("u-teacher", () =>
      workshopsUseCases.removeParticipant("au-live", added.id, "u-teacher"),
    );
    const rows = await auditRows("workshop_participants", added.id);
    const removed = rows.find((row) => row.actionType === "DELETE");
    expect(removed).toBeDefined();
    expect(await state(removed!.oldState ?? null)).toMatchObject({ id: added.id });
    expect(await state(removed!.newState ?? null)).toHaveProperty("deletedAt");
  });

  it("logs attendance and score edits as completion evidence", async () => {
    const participant = await as("u-teacher", () =>
      workshopsUseCases.addParticipant("au-live", CONTACTS[2]!),
    );
    await as("u-teacher", () =>
      workshopsUseCases.saveAttendanceDay(
        "au-live",
        { dayOn: "2099-03-01", marks: [{ participantId: participant.id, status: "present" }] },
        "u-teacher",
      ),
    );
    await as("u-teacher", () =>
      workshopsUseCases.saveScores("au-live", {
        scores: [
          { participantId: participant.id, criterionName: "Practical", score: 8, maxScore: 10 },
        ],
      }),
    );
    const attendance = await auditRows("workshop_attendance", `au-live:2099-03-01`);
    const scores = await auditRows("workshop_scores", "au-live");
    expect(attendance[0]).toMatchObject({ actionType: "CREATE", realUserId: "u-teacher" });
    expect(scores[0]).toMatchObject({ actionType: "CREATE", realUserId: "u-teacher" });
  });

  it("logs completion evaluation and certificate issuance per participant", async () => {
    await as("u-admin", () =>
      workshopsUseCases.createWorkshop({
        id: "au-past",
        title: "Past workshop",
        description: "",
        startDate: "2000-01-10",
        endDate: "2000-01-11",
      }),
    );
    await seedParticipant("au-past", "p-past", CONTACTS[1]!);
    await as("u-teacher", () =>
      workshopsUseCases.saveAttendanceDay(
        "au-past",
        {
          dayOn: "2000-01-10",
          marks: [{ participantId: "p-past", status: "present" }],
        },
        "u-teacher",
      ),
    );
    await as("u-teacher", () => workshopsCompletionUseCases.evaluateCompletion("au-past"));
    const evaluation = await findAudit(
      await auditRows("workshop_participants", "p-past"),
      "completion_evaluated",
    );
    expect(evaluation).toMatchObject({ actionType: "UPDATE", realUserId: "u-teacher" });
    expect(await state(evaluation!.newState ?? null)).toMatchObject({ status: "completed" });

    await as("u-teacher", () =>
      workshopsCompletionUseCases.issueCertificates("au-past", { participantIds: [] }),
    );
    const certificate = await findAudit(
      await auditRows("workshop_participants", "p-past"),
      "certificate_issued",
    );
    expect(certificate).toMatchObject({ actionType: "UPDATE", realUserId: "u-teacher" });
    expect(await state(certificate!.newState ?? null)).toHaveProperty("certificateIssuedAt");
  });

  it("logs Setup preference changes", async () => {
    await as("u-admin", () =>
      workshopsCompletionUseCases.savePreferences({
        defaultMinAttendancePct: 80,
        defaultMinScorePct: null,
      }),
    );
    const [row] = await auditRows("workshop_module_preferences", TENANT);
    expect(row).toMatchObject({ realUserId: "u-admin" });
    expect(["CREATE", "UPDATE"]).toContain(row!.actionType);
    expect(await state(row!.newState ?? null)).toMatchObject({ defaultMinAttendancePct: 80 });
  });

  it("logs each registration archived by a cancel", async () => {
    await as("u-admin", () => workshopsUseCases.addParticipant("au-live", CONTACTS[1]!));
    const detail = await as("u-admin", () => workshopsUseCases.getWorkshop("au-live"));
    const participant = detail.participants[0]!;
    await as("u-admin", () =>
      workshopsUseCases.transitionWorkshop(
        "au-live",
        { to: "cancelled", reason: "Venue flooded" },
        { id: "u-admin" },
        detail.workshop.updatedAt,
      ),
    );
    const archived = (await auditRows("workshop_participants", participant.id)).find(
      (row) => row.actionType === "DELETE",
    );
    expect(archived).toBeDefined();
    expect(await state(archived!.newState ?? null)).toMatchObject({ deletedWithCascade: true });
    const transition = await findAudit(await auditRows("workshop_events", "au-live"), "transition");
    expect(transition).toMatchObject({ actionType: "UPDATE", realUserId: "u-admin" });
  });

  it("rolls the audit row back with a failed mutation", async () => {
    const before = (await auditRows("workshop_participants")).length;
    await expect(
      as("u-admin", () => workshopsUseCases.addParticipant("au-live", CONTACTS[0]!)),
    ).rejects.toMatchObject({ type: "workshop_not_open" });
    expect(await auditRows("workshop_participants")).toHaveLength(before);
  });

  it("keeps audit rows immutable", async () => {
    const [row] = await auditRows("workshop_events", "au-live");
    await expect(
      withTenant(TENANT, (tx) =>
        tx
          .update(auditTrailEvents)
          .set({ actionType: "UPDATE" })
          .where(
            and(
              eq(auditTrailEvents.workspaceSubdomain, TENANT),
              eq(auditTrailEvents.recordId, row!.recordId),
            ),
          ),
      ),
    ).rejects.toThrow();
  });
});
