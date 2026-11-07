import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { auditTrailEvents, workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { softDeleteSessionWithCascade } from "../../db/repositories/sessionRepositoryCascade.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { transitionSession } from "../../sessions/use-cases/sessionTransitionService.js";
import { sessionLifecycleOpsUseCases } from "../../sessions/use-cases/sessionLifecycleOpsUseCases.js";
import { bindRequestUserId } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "session-audit-test";
const SESSION = "audit-session";
const AUDIT_USER = "u-audit";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function audits(table = "sessions", recordId = SESSION) {
  return withTenant(TENANT, (tx) =>
    tx
      .select({
        actionType: auditTrailEvents.actionType,
        realUserId: auditTrailEvents.realUserId,
        oldState: auditTrailEvents.oldState,
        newState: auditTrailEvents.newState,
        hashPrevious: auditTrailEvents.hashPrevious,
        hashCurrent: auditTrailEvents.hashCurrent,
      })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.tableName, table),
          eq(auditTrailEvents.recordId, recordId),
        ),
      )
      .orderBy(desc(auditTrailEvents.id)),
  );
}

const parse = (value: string | null): Record<string, unknown> | null =>
  value ? (JSON.parse(value) as Record<string, unknown>) : null;

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Audit test",
      enabled: true,
    });
  });
  bindRequestUserId(AUDIT_USER);
  await saveSession(
    TENANT,
    SessionSchema.parse({
      id: SESSION,
      name: "Audit Session",
      status: "draft",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      overlapExempt: true,
      classes: [{ id: "audit-class", name: "Class A", sections: [{ id: "audit-sec", name: "A" }] }],
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

describe("sessions audit trail (real Postgres)", () => {
  it("records create with the acting user and no pre-image", async () => {
    const rows = await audits();
    const create = rows.find((row) => row.actionType === "CREATE");
    expect(create).toBeDefined();
    expect(create?.realUserId).toBe(AUDIT_USER);
    expect(create?.oldState).toBeNull();
    expect(parse(create?.newState ?? null)).toMatchObject({ id: SESSION });
    expect(create?.hashPrevious).not.toBe(create?.hashCurrent);
  });

  it("records updates with both old and new state", async () => {
    const current = await findSessionById(TENANT, SESSION);
    await saveSession(
      TENANT,
      SessionSchema.parse({
        ...current,
        name: "Audit Session Renamed",
        classes: current?.classes ?? [],
      }),
    );
    const rows = await audits();
    const update = rows.find((row) => row.actionType === "UPDATE");
    expect(update).toBeDefined();
    expect(parse(update?.oldState ?? null)).toMatchObject({ id: SESSION, name: "Audit Session" });
    expect(parse(update?.newState ?? null)).toMatchObject({ name: "Audit Session Renamed" });
  });

  it("records status transitions with reason and old status", async () => {
    await transitionSession(TENANT, SESSION, {
      to: "open",
      reason: "Registration opened",
      actor: { userId: AUDIT_USER },
    });
    const rows = await audits();
    const transition = rows.find((row) => parse(row.newState ?? null)?.operation === "transition");
    expect(transition).toBeDefined();
    expect(parse(transition?.oldState ?? null)).toMatchObject({ status: "draft" });
    expect(parse(transition?.newState ?? null)).toMatchObject({
      from: "draft",
      to: "open",
      reason: "Registration opened",
    });
  });

  it("records postponement with old dates and the reason", async () => {
    const session = await findSessionById(TENANT, SESSION);
    await sessionLifecycleOpsUseCases.postpone(
      TENANT,
      SESSION,
      { startDate: "2027-02-01", reason: "Weather delay" },
      { id: AUDIT_USER, name: "Audit", email: "audit@test.com", role: "admin" } as never,
      { expectedVersion: session?.version },
    );
    const rows = await audits();
    const postpone = rows.find((row) => parse(row.newState ?? null)?.operation === "postpone");
    expect(postpone).toBeDefined();
    expect(parse(postpone?.oldState ?? null)).toMatchObject({ startDate: "2026-01-01" });
    expect(parse(postpone?.newState ?? null)).toMatchObject({
      reason: "Weather delay",
      shiftDays: 396,
    });
  });

  it("records archiving with the deletion reason and the pre-image", async () => {
    await softDeleteSessionWithCascade(TENANT, SESSION, AUDIT_USER, "Superseded");
    const rows = await audits();
    const deleted = rows.find((row) => row.actionType === "DELETE");
    expect(deleted).toBeDefined();
    expect(deleted?.realUserId).toBe(AUDIT_USER);
    expect(parse(deleted?.newState ?? null)).toMatchObject({ deletionReason: "Superseded" });
    expect(parse(deleted?.oldState ?? null)).toMatchObject({ id: SESSION, deletedAt: null });
  });
});
