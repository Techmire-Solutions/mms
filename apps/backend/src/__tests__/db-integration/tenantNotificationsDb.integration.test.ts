import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaces } from "../../db/schema.js";
import {
  insertTenantNotification,
  listTenantNotifications,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
} from "../../db/repositories/tenantNotificationsRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "notifications-test";
const OTHER = "notifications-other";
const ADMISSIONS = ["enrollments.write"];

async function purge(subdomain: string): Promise<void> {
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, subdomain));
  });
}

const seatOffer = (id: string, audiencePermission = "enrollments.write") => ({
  id,
  kind: "waitlist_seat_offered" as const,
  audiencePermission,
  entityType: "registration_application",
  entityId: `app-${id}`,
  subjectLabel: `Applicant ${id}`,
  contextLabel: "Hifz A",
});

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  for (const subdomain of [TENANT, OTHER]) {
    await purge(subdomain);
    await withTenant(subdomain, (tx) =>
      tx
        .insert(workspaces)
        .values({ id: subdomain, subdomain, madrasaName: subdomain, enabled: true }),
    );
  }
  await insertTenantNotification(TENANT, seatOffer("n1"));
  await insertTenantNotification(TENANT, seatOffer("n2"));
  await insertTenantNotification(TENANT, seatOffer("finance-only", "finance.write"));
  await insertTenantNotification(OTHER, seatOffer("other-tenant"));
});

afterAll(async () => {
  try {
    await purge(TENANT);
    await purge(OTHER);
  } finally {
    await closeDatabase();
  }
});

describe("tenant notifications (real Postgres)", () => {
  it("given a user's permissions, should list only notifications addressed to them, newest first", async () => {
    // Act
    const list = await listTenantNotifications(TENANT, "u1", ADMISSIONS);

    // Assert
    expect(list.notifications.map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(list.unreadCount).toBe(2);
    expect(list.notifications[0]).toMatchObject({
      kind: "waitlist_seat_offered",
      subjectLabel: "Applicant n2",
      contextLabel: "Hifz A",
      read: false,
    });
  });

  it("given no matching permission, should list nothing", async () => {
    expect(await listTenantNotifications(TENANT, "u1", ["sessions.read"])).toEqual({
      notifications: [],
      unreadCount: 0,
    });
  });

  it("given a read receipt, should mark it for that user only", async () => {
    // Act
    expect(await markTenantNotificationRead(TENANT, "n1", "u1", ADMISSIONS)).toBe(true);
    expect(await markTenantNotificationRead(TENANT, "n1", "u1", ADMISSIONS)).toBe(true);

    // Assert
    const mine = await listTenantNotifications(TENANT, "u1", ADMISSIONS);
    const theirs = await listTenantNotifications(TENANT, "u2", ADMISSIONS);
    expect(mine.notifications.find((n) => n.id === "n1")?.read).toBe(true);
    expect(mine.unreadCount).toBe(1);
    expect(theirs.unreadCount).toBe(2);
  });

  it("given a notification the user cannot see, should refuse to mark it", async () => {
    expect(await markTenantNotificationRead(TENANT, "finance-only", "u1", ADMISSIONS)).toBe(false);
    expect(await markTenantNotificationRead(TENANT, "other-tenant", "u1", ADMISSIONS)).toBe(false);
  });

  it("given mark-all, should clear every visible notification for the user", async () => {
    // Act
    await markAllTenantNotificationsRead(TENANT, "u2", ADMISSIONS);

    // Assert
    const list = await listTenantNotifications(TENANT, "u2", ADMISSIONS);
    expect(list.unreadCount).toBe(0);
    expect(list.notifications.every((n) => n.read)).toBe(true);
    const finance = await listTenantNotifications(TENANT, "u2", ["finance.write"]);
    expect(finance.unreadCount).toBe(1);
  });
});
