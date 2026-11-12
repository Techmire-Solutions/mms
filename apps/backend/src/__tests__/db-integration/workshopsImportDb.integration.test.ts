import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { auditTrailEvents, contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { importParticipantChunk } from "../../db/repositories/workshopParticipantImportRepository.js";
import { runWorkshopParticipantImport } from "../../workshops/jobs/workshopImportJob.js";
import type { BackgroundJobRunContext } from "../../services/backgroundJobWorkerService.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-import-${randomUUID().slice(0, 8)}`;
const CONTACTS = ["im-1", "im-2", "im-3", "im-4", "im-5"];
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
      madrasaName: "Workshop import",
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

describe("queued workshop participant import (real Postgres)", () => {
  it("seats and queues a chunk in input order, and a retry skips the committed rows", async () => {
    await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "imp-seat",
        title: "Import",
        description: "",
        startDate: "2099-06-01",
        endDate: "2099-06-02",
        capacity: 1,
        waitlistEnabled: true,
      }),
    );

    const first = await inTenant(() =>
      importParticipantChunk(TENANT, "imp-seat", CONTACTS.slice(0, 3)),
    );
    expect(first).toMatchObject({ added: 1, waitlisted: 2, skipped: 0, failed: [] });

    const retry = await inTenant(() =>
      importParticipantChunk(TENANT, "imp-seat", CONTACTS.slice(0, 3)),
    );
    expect(retry).toMatchObject({ added: 0, waitlisted: 0, skipped: 3, failed: [] });

    const detail = await inTenant(() => workshopsUseCases.getWorkshop("imp-seat"));
    expect(detail.participants.map((row) => row.contactId)).toEqual([CONTACTS[0]]);
    expect(detail.waitlisted.map((row) => row.contactId)).toEqual([CONTACTS[1], CONTACTS[2]]);

    const audits = await withTenantRead(TENANT, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "workshop_participants"),
          ),
        ),
    );
    expect(audits).toHaveLength(3);
  });

  it("runs the queued job against the real repository and is retry-safe", async () => {
    await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "imp-runner",
        title: "Runner",
        description: "",
        startDate: "2099-08-01",
        endDate: "2099-08-02",
        capacity: 10,
      }),
    );
    const ctx = {
      tenant: TENANT,
      userId: "u-import",
      jobId: "job-import",
      updateProgress: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    } as unknown as BackgroundJobRunContext;

    await inTenant(() =>
      runWorkshopParticipantImport({ workshopId: "imp-runner", contactIds: CONTACTS }, ctx),
    );
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.stringContaining("5 seated") }),
    );
    const first = await inTenant(() => workshopsUseCases.getWorkshop("imp-runner"));
    expect(first.participants).toHaveLength(5);

    await inTenant(() =>
      runWorkshopParticipantImport({ workshopId: "imp-runner", contactIds: CONTACTS }, ctx),
    );
    expect(ctx.complete).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: expect.stringContaining("5 already registered") }),
    );
    const retry = await inTenant(() => workshopsUseCases.getWorkshop("imp-runner"));
    expect(retry.participants).toHaveLength(5);
  });

  it("reports per-contact failures instead of aborting the chunk", async () => {
    await inTenant(() =>
      workshopsUseCases.createWorkshop({
        id: "imp-blocked",
        title: "Blocked",
        description: "",
        startDate: "2099-07-01",
        capacity: 1,
        waitlistEnabled: false,
      }),
    );
    await inTenant(() => workshopsUseCases.addParticipant("imp-blocked", CONTACTS[0]!));
    await withTenant(TENANT, (tx) =>
      tx
        .update(contacts)
        .set({ deletedAt: new Date() })
        .where(and(eq(contacts.workspaceSubdomain, TENANT), eq(contacts.id, CONTACTS[4]!))),
    );

    const result = await inTenant(() =>
      importParticipantChunk(TENANT, "imp-blocked", [CONTACTS[1]!, CONTACTS[4]!]),
    );
    expect(result.failed).toEqual([
      { contactId: CONTACTS[1], code: "capacity_full" },
      { contactId: CONTACTS[4], code: "contact_not_found" },
    ]);
    expect(result.added + result.waitlisted + result.skipped).toBe(0);
  });
});
