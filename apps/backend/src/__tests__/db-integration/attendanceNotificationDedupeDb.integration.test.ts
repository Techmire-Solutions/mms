import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import { tenantNotifications, workspaces } from "../../db/schema.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Notification idempotency at the database.
 *
 * The partial unique index is what makes the absence scan exactly-once when two producers race (a
 * manual job and the hourly sweep) or a retry re-sends the same alert. Rows without a key — every
 * other producer — must stay repeatable.
 */

const TENANT = "att-notif-dedupe";
const OTHER = "att-notif-dedupe-other";

/** Notifications cascade with the workspace, so dropping the workspaces is enough. */
async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx
      .delete(tenantNotifications)
      .where(eq(tenantNotifications.workspaceSubdomain, TENANT));
    await tx.tx
      .delete(tenantNotifications)
      .where(eq(tenantNotifications.workspaceSubdomain, OTHER));
    await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, OTHER));
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedWorkspace(subdomain: string): Promise<void> {
  await withTenant(
    subdomain,
    (tx) =>
      tx
        .insert(workspaces)
        .values({ id: `ws-${subdomain}`, subdomain, madrasaName: `Dedupe ${subdomain}` })
        .onConflictDoNothing(),
    { readOnly: false },
  );
}

function notification(subdomain: string, id: string, dedupeKey: string | null) {
  return {
    id,
    workspaceSubdomain: subdomain,
    kind: "attendance_chronic_absence" as const,
    audiencePermission: "students.write",
    entityType: "attendance_absence_alert",
    entityId: "alert-1",
    subjectLabel: "student-1",
    contextLabel: "",
    dedupeKey,
  };
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await seedWorkspace(TENANT);
  await seedWorkspace(OTHER);
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("tenant_notifications dedupe key", () => {
  it("stores one row per (workspace, dedupe key)", async () => {
    const first = await withTenant(
      TENANT,
      (tx) =>
        tx
          .insert(tenantNotifications)
          .values(notification(TENANT, "n-1", "absence-alert:alert-1"))
          .onConflictDoNothing()
          .returning({ id: tenantNotifications.id }),
      { readOnly: false },
    );
    const second = await withTenant(
      TENANT,
      (tx) =>
        tx
          .insert(tenantNotifications)
          .values(notification(TENANT, "n-2", "absence-alert:alert-1"))
          .onConflictDoNothing()
          .returning({ id: tenantNotifications.id }),
      { readOnly: false },
    );

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    const rows = await withTenantRead(TENANT, (tx) =>
      tx
        .select({ id: tenantNotifications.id })
        .from(tenantNotifications)
        .where(eq(tenantNotifications.workspaceSubdomain, TENANT)),
    );
    expect(rows).toHaveLength(1);
  });

  it("allows the same key in another workspace", async () => {
    const inserted = await withTenant(
      OTHER,
      (tx) =>
        tx
          .insert(tenantNotifications)
          .values(notification(OTHER, "n-3", "absence-alert:alert-1"))
          .onConflictDoNothing()
          .returning({ id: tenantNotifications.id }),
      { readOnly: false },
    );
    expect(inserted).toHaveLength(1);
  });

  it("keeps keyless notifications repeatable (existing producers unchanged)", async () => {
    const rows = await withTenant(
      TENANT,
      (tx) =>
        tx
          .insert(tenantNotifications)
          .values([notification(TENANT, "n-4", null), notification(TENANT, "n-5", null)])
          .onConflictDoNothing()
          .returning({ id: tenantNotifications.id }),
      { readOnly: false },
    );
    expect(rows).toHaveLength(2);
  });
});
