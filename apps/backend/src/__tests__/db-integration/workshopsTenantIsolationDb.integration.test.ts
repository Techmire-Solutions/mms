import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { contacts, workshopEvents, workshopParticipants, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const A = `ws-iso-a-${randomUUID().slice(0, 6)}`;
const B = `ws-iso-b-${randomUUID().slice(0, 6)}`;
const TENANTS = [A, B];
const inTenant = <T>(tenant: string, fn: () => Promise<T>) => runWithTenant(tenant, fn);

async function purge(): Promise<void> {
  for (const tenant of TENANTS) {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  for (const tenant of TENANTS) {
    await withTenant(tenant, async (tx) => {
      await tx.insert(workspaces).values({
        id: tenant,
        subdomain: tenant,
        madrasaName: tenant,
        enabled: true,
      });
      await tx.insert(contacts).values({
        id: "c-shared",
        workspaceSubdomain: tenant,
        firstName: tenant,
        name: `Contact ${tenant}`,
      });
    });
  }
  // Same workshop id in both tenants: only the tenant filter/RLS can tell them apart.
  for (const tenant of TENANTS) {
    await inTenant(tenant, () =>
      workshopsUseCases.createWorkshop({
        id: "shared-ws",
        title: `Workshop ${tenant}`,
        description: "",
        startDate: "2099-04-01",
        endDate: "2099-04-02",
        capacity: 3,
      }),
    );
    await withTenant(tenant, (tx) =>
      tx.insert(workshopParticipants).values({
        id: "p-shared",
        workspaceSubdomain: tenant,
        workshopId: "shared-ws",
        contactId: "c-shared",
        status: "registered",
      }),
    );
  }
});

afterAll(async () => {
  try {
    await purge();
  } finally {
    await closeDatabase();
  }
});

describe("workshop tenant isolation (real Postgres)", () => {
  it("reads only the caller tenant's workshop, roster and completion", async () => {
    const a = await inTenant(A, () => workshopsUseCases.getWorkshop("shared-ws"));
    const b = await inTenant(B, () => workshopsUseCases.getWorkshop("shared-ws"));
    expect(a.workshop.title).toBe(`Workshop ${A}`);
    expect(b.workshop.title).toBe(`Workshop ${B}`);
    expect(a.participants[0]?.contactName).toBe(`Contact ${A}`);
    expect(b.participants[0]?.contactName).toBe(`Contact ${B}`);
    expect(a.participants[0]?.id).toBe(b.participants[0]?.id); // same id, different tenant row

    const completionA = await inTenant(A, () =>
      workshopsCompletionUseCases.getCompletion("shared-ws"),
    );
    expect(completionA).toHaveLength(1);
    expect(completionA[0]?.contactName).toBe(`Contact ${A}`);
  });

  it("cannot read, write or complete a workshop that exists only in another tenant", async () => {
    await inTenant(B, () =>
      workshopsUseCases.createWorkshop({
        id: "b-only",
        title: "Only B",
        description: "",
        startDate: "2099-05-01",
      }),
    );
    await inTenant(B, () => workshopsUseCases.addParticipant("b-only", "c-shared"));

    await expect(inTenant(A, () => workshopsUseCases.getWorkshop("b-only"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      inTenant(A, () => workshopsUseCases.addParticipant("b-only", "c-shared")),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      inTenant(A, () =>
        workshopsUseCases.saveAttendanceDay(
          "b-only",
          { dayOn: "2099-05-01", marks: [] },
          "a-admin",
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      inTenant(A, () => workshopsUseCases.removeParticipant("b-only", "x", "a-admin")),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      inTenant(A, () => workshopsCompletionUseCases.evaluateCompletion("b-only")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("filters report, metrics and direct reads to the caller tenant", async () => {
    const reportA = await inTenant(A, () => workshopsCompletionUseCases.getReport());
    const metricsA = await inTenant(A, () => workshopsUseCases.loadMetrics());
    expect(reportA.map((row) => row.workshopId)).not.toContain("b-only");
    expect(metricsA.total).toBeGreaterThanOrEqual(1);

    const leaked = await withTenantRead(A, (tx) =>
      tx
        .select({ id: workshopEvents.id })
        .from(workshopEvents)
        .where(and(eq(workshopEvents.workspaceSubdomain, A), eq(workshopEvents.id, "b-only"))),
    );
    expect(leaked).toHaveLength(0);
  });

  it("isolates Setup preferences per tenant", async () => {
    await inTenant(A, () =>
      workshopsCompletionUseCases.savePreferences({
        defaultMinAttendancePct: 80,
        defaultMinScorePct: null,
      }),
    );
    await inTenant(B, () =>
      workshopsCompletionUseCases.savePreferences({
        defaultMinAttendancePct: 20,
        defaultMinScorePct: null,
      }),
    );
    expect(
      (await inTenant(A, () => workshopsCompletionUseCases.getPreferences()))
        .defaultMinAttendancePct,
    ).toBe(80);
    expect(
      (await inTenant(B, () => workshopsCompletionUseCases.getPreferences()))
        .defaultMinAttendancePct,
    ).toBe(20);
  });

  it("refuses an audit append into another tenant from a bound request", async () => {
    await expect(
      inTenant(A, () =>
        recordModernAuditEvent({
          workspaceSubdomain: B,
          tableName: "workshop_events",
          recordId: "shared-ws",
          actionType: "UPDATE",
        }),
      ),
    ).rejects.toThrow(/refusing to append/);
  });

  it("keeps same-id participant rows separated by tenant", async () => {
    const a = await withTenantRead(A, (tx) =>
      tx
        .select({ tenant: workshopParticipants.workspaceSubdomain })
        .from(workshopParticipants)
        .where(
          and(
            eq(workshopParticipants.workspaceSubdomain, A),
            eq(workshopParticipants.id, "p-shared"),
          ),
        ),
    );
    const b = await withTenantRead(B, (tx) =>
      tx
        .select({ tenant: workshopParticipants.workspaceSubdomain })
        .from(workshopParticipants)
        .where(
          and(
            eq(workshopParticipants.workspaceSubdomain, B),
            eq(workshopParticipants.id, "p-shared"),
          ),
        ),
    );
    expect(a.map((row) => row.tenant)).toEqual([A]);
    expect(b.map((row) => row.tenant)).toEqual([B]);
  });
});
