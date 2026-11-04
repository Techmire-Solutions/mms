import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { Contact, User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { auditTrailEvents } from "../../db/schema/auditTrail.js";
import { contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { upsertContact } from "../../contacts/use-cases/contactWriteUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `audit-atomic-${randomUUID().slice(0, 8)}`;

/**
 * `audit_trail_events.record_id` is `varchar(128)`; a longer id makes the audit
 * insert fail naturally on the production path — no module mocking — which is
 * exactly the failure mode the transaction must roll back.
 */
const FAILING_CONTACT_ID = `c-${"x".repeat(140)}`;

const ADMIN = {
  id: "u-admin",
  name: "Admin",
  email: "admin@example.test",
  role: "admin",
  workspaceSubdomain: TENANT,
} as User;

function contact(id: string): Contact {
  return {
    id,
    firstName: "Audit",
    lastName: "Probe",
    name: "Audit Probe",
  } as Contact;
}

async function contactExists(id: string): Promise<boolean> {
  const rows = await withTenant(TENANT, (tx) =>
    tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, id)),
  );
  return rows.length > 0;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM contacts WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Audit atomicity", enabled: true });
  });
});

afterAll(async () => {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM contacts WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
  await closeDatabase();
});

describe("Contact audit atomicity", () => {
  it("rolls the contact write back when the audit append fails", async () => {
    await runWithTenant(TENANT, async () => {
      await expect(
        upsertContact(contact(FAILING_CONTACT_ID), { user: ADMIN, actorId: ADMIN.id }),
      ).rejects.toThrow();
    });

    await expect(contactExists(FAILING_CONTACT_ID)).resolves.toBe(false);
  });

  it("commits exactly one CREATE audit row with the contact", async () => {
    await runWithTenant(TENANT, async () => {
      await upsertContact(contact("contact-audit-ok"), { user: ADMIN, actorId: ADMIN.id });
    });

    await expect(contactExists("contact-audit-ok")).resolves.toBe(true);
    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ actionType: auditTrailEvents.actionType })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "contacts"),
            eq(auditTrailEvents.recordId, "contact-audit-ok"),
          ),
        ),
    );
    expect(rows).toEqual([{ actionType: "CREATE" }]);
  });
});
