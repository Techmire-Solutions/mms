import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  auditTrailEvents,
  contacts,
  outboxEvents,
  workshopParticipants,
  workspaces,
} from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import type { WorkshopEvent, WorkshopTransitionBody } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-lifecycle-${randomUUID().slice(0, 8)}`;
const CONTACTS = ["lc-1", "lc-2", "lc-3", "lc-4"];
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
      madrasaName: "Workshop lifecycle",
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

async function createWorkshop(
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<WorkshopEvent> {
  return inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: id,
      description: "",
      ...overrides,
    }),
  );
}

async function transition(
  id: string,
  to: WorkshopTransitionBody["to"],
  options: { reason?: string; token?: string | null } = {},
): Promise<{ status: string; phase: string }> {
  const current = await inTenant(() => workshopsUseCases.getWorkshop(id));
  return inTenant(() =>
    workshopsUseCases.transitionWorkshop(
      id,
      { to, ...(options.reason ? { reason: options.reason } : {}) },
      { id: "u-admin", label: "Admin" },
      options.token === undefined ? current.workshop.updatedAt : options.token,
    ),
  );
}

async function outboxRowsFor(entityType: string): Promise<string[]> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ entityId: outboxEvents.entityId })
      .from(outboxEvents)
      .where(
        and(eq(outboxEvents.workspaceSubdomain, TENANT), eq(outboxEvents.entityType, entityType)),
      ),
  );
  return rows.map((row) => row.entityId);
}

async function auditRowsFor(recordId: string): Promise<string[]> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ action: auditTrailEvents.actionType })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.tableName, "workshop_events"),
          eq(auditTrailEvents.recordId, recordId),
        ),
      ),
  );
  return rows.map((row) => row.action);
}

describe("workshop lifecycle (real Postgres)", () => {
  it("defaults to open and derives the product phase from the workspace day", async () => {
    const future = await createWorkshop("lc-future", {
      startDate: "2099-01-01",
      endDate: "2099-01-02",
    });
    expect(future.status).toBe("open");
    expect(future.phase).toBe("registration_open");

    const draft = await createWorkshop("lc-draft", { status: "draft", startDate: "2099-01-01" });
    expect(draft.status).toBe("draft");
    expect(draft.phase).toBe("draft");

    const dateless = await createWorkshop("lc-dateless");
    expect(dateless.phase).toBe("registration_open");
  });

  it("refuses registration into a draft and accepts it after publishing", async () => {
    await createWorkshop("lc-publish", {
      status: "draft",
      startDate: "2099-02-01",
      endDate: "2099-02-02",
    });
    await expect(
      inTenant(() => workshopsUseCases.addParticipant("lc-publish", CONTACTS[0]!)),
    ).rejects.toMatchObject({ type: "workshop_not_open" });

    const published = await transition("lc-publish", "open");
    expect(published.status).toBe("open");

    const participant = await inTenant(() =>
      workshopsUseCases.addParticipant("lc-publish", CONTACTS[0]!),
    );
    expect(participant.id).toBeTruthy();
  });

  it("refuses to unpublish a workshop that already sold seats", async () => {
    await createWorkshop("lc-unpublish", { startDate: "2099-03-01", endDate: "2099-03-02" });
    await inTenant(() => workshopsUseCases.addParticipant("lc-unpublish", CONTACTS[1]!));

    await expect(transition("lc-unpublish", "draft")).rejects.toMatchObject({
      type: "workshop_has_registrations",
    });
  });

  it("requires the last day before completion and closes structural edits afterwards", async () => {
    await createWorkshop("lc-complete", { startDate: "2099-04-01", endDate: "2099-04-02" });
    await expect(transition("lc-complete", "completed")).rejects.toMatchObject({
      type: "completion_before_end_date",
    });

    await createWorkshop("lc-completed", { startDate: "2000-01-01", endDate: "2000-01-02" });
    await withTenant(TENANT, (tx) =>
      tx.insert(workshopParticipants).values({
        id: "lc-completed-participant",
        workspaceSubdomain: TENANT,
        workshopId: "lc-completed",
        contactId: CONTACTS[0]!,
        status: "registered",
      }),
    );
    const completed = await transition("lc-completed", "completed");
    expect(completed.status).toBe("completed");
    expect(completed.phase).toBe("completed");

    await expect(
      inTenant(() => workshopsUseCases.updateWorkshop("lc-completed", { title: "Renamed" })),
    ).rejects.toMatchObject({ type: "workshop_read_only" });

    // Corrections to a completed workshop's check-ins stay possible.
    const marks = await inTenant(() =>
      workshopsUseCases.saveAttendanceDay(
        "lc-completed",
        {
          dayOn: "2000-01-01",
          marks: [{ participantId: "lc-completed-participant", status: "present" }],
        },
        "u-admin",
      ),
    );
    expect(marks).toHaveLength(1);
  });

  it("cancels atomically: registrations archived with provenance, outbox + audit in the same commit", async () => {
    await createWorkshop("lc-cancel", { startDate: "2099-05-01", endDate: "2099-05-02" });
    const participant = await inTenant(() =>
      workshopsUseCases.addParticipant("lc-cancel", CONTACTS[2]!),
    );

    const cancelled = await transition("lc-cancel", "cancelled", { reason: "Venue unavailable" });
    expect(cancelled.status).toBe("cancelled");

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({
          deletedAt: workshopParticipants.deletedAt,
          cascade: workshopParticipants.deletedWithCascade,
          reason: workshopParticipants.deletionReason,
        })
        .from(workshopParticipants)
        .where(
          and(
            eq(workshopParticipants.workspaceSubdomain, TENANT),
            eq(workshopParticipants.id, participant.id),
          ),
        ),
    );
    expect(rows[0]?.deletedAt).toBeTruthy();
    expect(rows[0]?.cascade).toBe(true);
    expect(rows[0]?.reason).toBe("Venue unavailable");
    expect(await outboxRowsFor("workshop_participants")).toContain(participant.id);
    expect(await auditRowsFor("lc-cancel")).toContain("UPDATE");

    await expect(
      inTenant(() => workshopsUseCases.addParticipant("lc-cancel", CONTACTS[3]!)),
    ).rejects.toMatchObject({ type: "workshop_not_open" });
  });

  it("refuses to cancel once certificates were issued", async () => {
    await createWorkshop("lc-cert-cancel", { startDate: "2000-02-01", endDate: "2000-02-02" });
    await withTenant(TENANT, (tx) =>
      tx.insert(workshopParticipants).values({
        id: "lc-certified",
        workspaceSubdomain: TENANT,
        workshopId: "lc-cert-cancel",
        contactId: CONTACTS[0]!,
        status: "completed",
        completedAt: new Date(),
        certificateIssuedAt: new Date(),
      }),
    );

    await expect(
      transition("lc-cert-cancel", "cancelled", { reason: "Changed plans" }),
    ).rejects.toMatchObject({ type: "certificates_issued" });
  });

  it("requires a fresh OCC token and reports a stale one as a conflict", async () => {
    await createWorkshop("lc-occ", { startDate: "2099-06-01", endDate: "2099-06-02" });

    await expect(
      transition("lc-occ", "cancelled", { reason: "No venue", token: null }),
    ).rejects.toMatchObject({
      statusCode: 428,
    });
    await expect(
      transition("lc-occ", "cancelled", {
        reason: "No venue",
        token: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ type: "stale_workshop" });
  });

  it("rolls the whole cancel back when a later step fails", async () => {
    await createWorkshop("lc-rollback", { startDate: "2099-07-01", endDate: "2099-07-02" });
    const participant = await inTenant(() =>
      workshopsUseCases.addParticipant("lc-rollback", CONTACTS[1]!),
    );
    const current = await inTenant(() => workshopsUseCases.getWorkshop("lc-rollback"));

    // The cancellation reason column is varchar(500): a longer value reaches the registration
    // archive UPDATE (after the status CAS and before the commit) and fails with 22001. The use
    // case is called directly here to bypass the contract's `max(500)`, which is exactly what lets
    // the test prove the transaction — not the validator — is what keeps the state consistent.
    await expect(
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "lc-rollback",
          { to: "cancelled", reason: "x".repeat(600) },
          { id: "u-admin" },
          current.workshop.updatedAt,
        ),
      ),
    ).rejects.toThrow();

    const after = await inTenant(() => workshopsUseCases.getWorkshop("lc-rollback"));
    expect(after.workshop.status).toBe("open");
    expect(after.participants.map((row) => row.id)).toContain(participant.id);
    expect(await outboxRowsFor("workshop_participants")).not.toContain(participant.id);
  });

  it("gates certificates on the last day and refuses certified withdrawals", async () => {
    await createWorkshop("lc-cert-future", { startDate: "2099-08-01", endDate: "2099-08-02" });
    await expect(
      inTenant(() =>
        workshopsCompletionUseCases.issueCertificates("lc-cert-future", { participantIds: [] }),
      ),
    ).rejects.toMatchObject({ type: "workshop_not_finished" });

    await expect(
      inTenant(() =>
        workshopsUseCases.removeParticipant("lc-cert-cancel", "lc-certified", "u-admin"),
      ),
    ).rejects.toMatchObject({ type: "certificate_issued" });

    await expect(
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "lc-cert-cancel",
          { to: "cancelled", reason: "Changed plans" },
          { id: "u-admin" },
          "not-a-date",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      inTenant(() => workshopsUseCases.addParticipant("does-not-exist", CONTACTS[0]!)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("blocks a cancelled workshop's registration without a raw database error", async () => {
    await createWorkshop("lc-cancel-register", { startDate: "2099-09-01", endDate: "2099-09-02" });
    await inTenant(() => workshopsUseCases.addParticipant("lc-cancel-register", CONTACTS[3]!));
    await transition("lc-cancel-register", "cancelled", { reason: "Tutor unavailable" });

    await expect(
      inTenant(() => workshopsUseCases.addParticipant("lc-cancel-register", CONTACTS[0]!)),
    ).rejects.toMatchObject({ type: "workshop_not_open" });
  });
});
