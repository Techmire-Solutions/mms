import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaces } from "../../db/schema.js";
import { contactUseCases } from "../../contacts/use-cases/contactUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "contacts-concurrency-regression";
const contactId = "occ-contact-1";

async function seedContact(): Promise<void> {
  await runWithTenant(tenant, () =>
    contactUseCases.upsertContact({
      id: contactId,
      firstName: "Ali",
      lastName: "Khan",
      name: "Ali Khan",
      phones: [{ label: "Mobile", number: "03001234567", countryCode: "PK", isPrimary: true }],
      emails: [],
    } as Contact),
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Contacts concurrency test",
      enabled: true,
    });
  });
  await seedContact();
});

afterAll(async () => {
  try {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  } finally {
    await closeDatabase();
  }
});

describe("contacts concurrent writes (Postgres)", () => {
  it("lets exactly one of two same-version updates win (C-01)", async () => {
    const current = await runWithTenant(tenant, () => contactUseCases.getContactById(contactId));
    const stamp = current?.updatedAt;
    expect(stamp).toBeTruthy();

    const results = await runWithTenant(tenant, () =>
      Promise.allSettled([
        contactUseCases.updateContactById(
          contactId,
          { id: contactId, firstName: "Ali", name: "Ali Khan", notes: "editor A" },
          { expectedUpdatedAt: stamp },
        ),
        contactUseCases.updateContactById(
          contactId,
          { id: contactId, firstName: "Ali", name: "Ali Khan", notes: "editor B" },
          { expectedUpdatedAt: stamp },
        ),
      ]),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
  });

  it("tag writes preserve child collections (C-03)", async () => {
    await runWithTenant(tenant, () =>
      contactUseCases.bulkTagContacts([contactId], {
        addTags: ["VIP"],
        actorId: "u-admin",
      }),
    );

    const saved = await runWithTenant(tenant, () => contactUseCases.getContactById(contactId));
    expect(saved?.tags).toContain("VIP");
    expect(saved?.phones?.[0]?.number).toContain("3001234567");
  });
});
