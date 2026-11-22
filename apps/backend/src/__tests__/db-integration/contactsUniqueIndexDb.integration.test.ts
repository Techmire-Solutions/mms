import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { contacts, contactEmails, contactPhones, workspaces } from "../../db/schema.js";
import { requireDatabaseConnection, extractPgErrorCode } from "./dbTestSupport.js";

const TEST_SUBDOMAIN = "contact-unique-idx-test";
const WORKSPACE_ID = "ws-contact-unique-idx-test";

/**
 * Pins the recyclable-unique backstop restored by migrations 0264/0270: after 3NF
 * normalization dropped the legacy `contacts.phone`/`contacts.email` columns
 * (and their partial unique indexes), the child tables carried no DB-level
 * uniqueness. 0264 re-added email + phone indexes; 0270 keyed the phone index on
 * the full E.164 key (country_code + number) so distinct dial codes do not collide.
 */
beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();

  const seedTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await seedTx.tx
      .insert(workspaces)
      .values({
        id: WORKSPACE_ID,
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Contact Unique Index Test",
        enabled: true,
      })
      .onConflictDoNothing();
    await seedTx.tx.insert(contacts).values([
      { id: "c-1", workspaceSubdomain: TEST_SUBDOMAIN, firstName: "Aisha", name: "Aisha" },
      { id: "c-2", workspaceSubdomain: TEST_SUBDOMAIN, firstName: "Bilal", name: "Bilal" },
    ]);
    // First-row values the duplicate inserts below must collide with.
    await seedTx.tx.insert(contactEmails).values({
      id: "e-1",
      workspaceSubdomain: TEST_SUBDOMAIN,
      contactId: "c-1",
      address: "Aisha@Example.com",
    });
    await seedTx.tx.insert(contactPhones).values({
      id: "p-1",
      workspaceSubdomain: TEST_SUBDOMAIN,
      contactId: "c-1",
      number: "0300 1234567",
      countryCode: "+92",
    });
    await seedTx.commit();
  } catch (error) {
    await seedTx.rollback().catch(() => undefined);
    throw error;
  }
});

afterAll(async () => {
  try {
    const cleanupTx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      await cleanupTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await cleanupTx.tx
        .delete(contactEmails)
        .where(eq(contactEmails.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx
        .delete(contactPhones)
        .where(eq(contactPhones.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
      await cleanupTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
      await cleanupTx.commit();
    } catch {
      await cleanupTx.rollback().catch(() => undefined);
    }
  } finally {
    await closeDatabase();
  }
});

describe("contact phone/email partial unique indexes (real Postgres)", () => {
  it("rejects a duplicate normalized email address (23505)", async () => {
    const tx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      const insert = tx.tx.insert(contactEmails).values({
        id: "e-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        contactId: "c-2",
        address: "aisha@example.com", // differs only by case from e-1
      });
      await expect(insert).rejects.toSatisfy((error) => extractPgErrorCode(error) === "23505");
      await tx.rollback();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("rejects a duplicate normalized phone number (23505)", async () => {
    const tx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      const insert = tx.tx.insert(contactPhones).values({
        id: "p-2",
        workspaceSubdomain: TEST_SUBDOMAIN,
        contactId: "c-2",
        number: "03001234567", // same digits as p-1, different formatting
        countryCode: "+92",
      });
      await expect(insert).rejects.toSatisfy((error) => extractPgErrorCode(error) === "23505");
      await tx.rollback();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });

  it("allows the same national number under a different country code (distinct E.164)", async () => {
    const tx = await beginLongLivedTenantTransaction(TEST_SUBDOMAIN);
    try {
      const insert = tx.tx.insert(contactPhones).values({
        id: "p-3",
        workspaceSubdomain: TEST_SUBDOMAIN,
        contactId: "c-2",
        number: "03001234567", // same national significant number as p-1
        countryCode: "+1", // different dial code → different E.164 key
      });
      await expect(insert).resolves.toBeTruthy();
      await tx.rollback();
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  });
});
