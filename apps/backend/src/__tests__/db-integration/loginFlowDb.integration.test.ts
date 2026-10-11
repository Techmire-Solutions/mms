import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { buildApp } from "../../app.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { workspaces, tenantUsers, platformUsers, contacts } from "../../db/schema.js";
import {
  beginLongLivedTenantTransaction,
  closeDatabase,
  getRootDb,
} from "../../db/dbConnection.js";
import { hashPassword } from "../../services/auth/passwordService.js";
import type { FastifyInstance } from "fastify";

const TEST_SUBDOMAIN = "tms-login-test";
const TEST_SUPER_EMAIL = "super-test-login@example.com";
const TEST_TENANT_EMAIL = "tenant-test-login@example.com";
const TEST_PASSWORD = "ValidPassword123!";

let app: FastifyInstance;

beforeAll(async () => {
  await requireDatabaseConnection();
  app = await buildApp();

  // Cleanup prior test state
  const cleanTx = await beginLongLivedTenantTransaction(null);
  try {
    await cleanTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanTx.tx.delete(tenantUsers).where(eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(platformUsers).where(eq(platformUsers.email, TEST_SUPER_EMAIL));
    await cleanTx.commit();
  } catch {
    await cleanTx.rollback().catch(() => undefined);
  }

  // Seed workspace
  const seedTx = await beginLongLivedTenantTransaction(null);
  try {
    await seedTx.tx.insert(workspaces).values({
      id: `ws-${TEST_SUBDOMAIN}`,
      subdomain: TEST_SUBDOMAIN,
      madrasaName: "Test Login Madrasa",
      enabled: true,
    });

    const hash = await hashPassword(TEST_PASSWORD);

    const [existingSuper] = await seedTx.tx
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.role, "super_user"))
      .limit(1);

    if (existingSuper) {
      await seedTx.tx
        .update(platformUsers)
        .set({ passwordHash: hash })
        .where(eq(platformUsers.id, existingSuper.id));
    } else {
      await seedTx.tx.insert(platformUsers).values({
        id: "super-user-login-test",
        email: TEST_SUPER_EMAIL,
        name: "Super User",
        passwordHash: hash,
        role: "super_user",
        sessionVersion: 1,
      });
    }

    // Seed contact
    await seedTx.tx.insert(contacts).values({
      id: "contact-user-login-test",
      workspaceSubdomain: TEST_SUBDOMAIN,
      name: "Tenant User",
      firstName: "Tenant",
      lastName: "User",
    });

    // Seed regular tenant user linked to contact
    await seedTx.tx.insert(tenantUsers).values({
      id: "tenant-user-login-test",
      workspaceSubdomain: TEST_SUBDOMAIN,
      loginEmail: TEST_TENANT_EMAIL,
      name: "Tenant User",
      passwordHash: hash,
      role: "admin",
      emailVerifiedAt: new Date(),
      contactId: "contact-user-login-test",
    });

    await seedTx.commit();
  } catch (err) {
    await seedTx.rollback().catch(() => undefined);
    throw err;
  }
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
  const cleanTx = await beginLongLivedTenantTransaction(null);
  try {
    await cleanTx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanTx.tx.delete(tenantUsers).where(eq(tenantUsers.workspaceSubdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(workspaces).where(eq(workspaces.subdomain, TEST_SUBDOMAIN));
    await cleanTx.tx.delete(platformUsers).where(eq(platformUsers.email, TEST_SUPER_EMAIL));
    await cleanTx.commit();
  } catch {
    await cleanTx.rollback().catch(() => undefined);
  }
  await closeDatabase();
});

describe("POST /api/auth/login DB Integration", () => {
  it("logs in regular tenant user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { host: `${TEST_SUBDOMAIN}.localhost` },
      payload: {
        email: TEST_TENANT_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(TEST_TENANT_EMAIL);
  });

  it("logs in platform superuser via tenant sync", async () => {
    const [superRow] = await getRootDb()
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.role, "super_user"))
      .limit(1);
    const targetEmail = superRow?.email;

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { host: `${TEST_SUBDOMAIN}.localhost` },
      payload: {
        email: targetEmail,
        password: TEST_PASSWORD,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it("test VALUES with ::text in Postgres", async () => {
    const db = getRootDb();
    const contactIds = ["c1", "c2", "c3"];

    const valuesQuery = await (db as any).execute(sql`
      SELECT c.id AS "contactId"
      FROM (VALUES ${sql.join(
        contactIds.map((id) => sql`(${id}::text)`),
        sql`, `,
      )}) AS c(id)
    `);
    expect(valuesQuery.rows).toHaveLength(3);
    expect(valuesQuery.rows[0].contactId).toBe("c1");
  });

  it("test IN (${sql.join(...)}) with multiple IDs in Postgres", async () => {
    const db = getRootDb();
    const studentIds = ["s1", "s2", "s3"];

    const inQuery = await (db as any).execute(sql`
      SELECT id FROM workspaces WHERE id IN (${sql.join(
        studentIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    expect(Array.isArray(inQuery.rows)).toBe(true);
  });

  it("test loadContactChildMapsAggregated with contactIds", async () => {
    const { loadContactChildMapsAggregated, loadContactSummaryChildMapsAggregated } =
      await import("../../db/repositories/contactRepositoryHydrateChildren.js");
    const db = getRootDb();
    const res = await loadContactChildMapsAggregated(db as any, TEST_SUBDOMAIN, ["c1", "c2"]);
    expect(res).toBeDefined();
    const summaryRes = await loadContactSummaryChildMapsAggregated(db as any, TEST_SUBDOMAIN, [
      "c1",
      "c2",
    ]);
    expect(summaryRes).toBeDefined();
  });

  it("test hydrateSessionsListAggregated with sessionIds", async () => {
    const { hydrateSessionsListAggregated, hydrateSessionsListSummary } =
      await import("../../db/repositories/sessionRepositoryHydrate.js");
    const db = getRootDb();
    const classesMap = await hydrateSessionsListAggregated(db as any, TEST_SUBDOMAIN, [
      { id: "sess1" } as any,
      { id: "sess2" } as any,
    ]);
    expect(classesMap).toBeDefined();
    const summaryMap = await hydrateSessionsListSummary(db as any, TEST_SUBDOMAIN, [
      { id: "sess1" } as any,
      { id: "sess2" } as any,
    ]);
    expect(summaryMap).toBeDefined();
  });

  it("test hydrateStudentsList with student rows", async () => {
    const { hydrateStudentsList } =
      await import("../../db/repositories/studentRepositoryHydrate.js");
    const db = getRootDb();
    const studentsList = await hydrateStudentsList(db as any, TEST_SUBDOMAIN, [
      { id: "st1", workspaceSubdomain: TEST_SUBDOMAIN, name: "Student 1" } as any,
      { id: "st2", workspaceSubdomain: TEST_SUBDOMAIN, name: "Student 2" } as any,
    ]);
    expect(studentsList).toHaveLength(2);
  });
});
