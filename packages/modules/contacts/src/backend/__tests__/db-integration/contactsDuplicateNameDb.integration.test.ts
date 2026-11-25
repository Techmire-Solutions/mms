import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Contact } from "@mms/contracts";
import { closeDatabase } from "@mms/db/client";
import { withTenant } from "@mms/db/context";
import { workspaces } from "@mms/db/schema";
import { contactUseCases } from "../../use-cases/index.js";
import { contactsRepository } from "../../repository/index.js";
import { runWithTenant } from "@mms/be-core/http";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "contacts-duplicate-name";
const otherTenant = "contacts-duplicate-name-other";

function person(id: string, name: string, extra: Partial<Contact> = {}): Contact {
  return { id, name, firstName: name, ...extra } as Contact;
}

async function createWorkspace(subdomain: string): Promise<void> {
  await withTenant(subdomain, async (tx) => {
    await tx.insert(workspaces).values({
      id: subdomain,
      subdomain,
      madrasaName: "Duplicate name test",
      enabled: true,
    });
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await createWorkspace(tenant);
  await createWorkspace(otherTenant);
  await runWithTenant(tenant, async () => {
    // One parent with two children, recorded as two guardian contacts (admissions pattern).
    await contactUseCases.upsertContact(person("dup-g1", "Abdul Rahman"));
    await contactUseCases.upsertContact(person("dup-g2", "Abdul Rahman"));
    await contactUseCases.upsertContact(
      person("dup-s1", "Ahmed", {
        relationshipContacts: [{ contactId: "dup-g1", relationship: "guardian" }],
      }),
    );
    await contactUseCases.upsertContact(
      person("dup-s2", "Fatima", {
        relationshipContacts: [{ contactId: "dup-g2", relationship: "Father" }],
      }),
    );
    // Two unrelated contacts whose names differ only by case/spacing.
    await contactUseCases.upsertContact(person("dup-x1", "Bilal Ahmed"));
    await contactUseCases.upsertContact(person("dup-x2", "  bilal   AHMED "));
  });
  await runWithTenant(otherTenant, () =>
    contactUseCases.upsertContact(person("dup-o1", "Bilal Ahmed")),
  );
});

afterAll(async () => {
  try {
    for (const subdomain of [tenant, otherTenant]) {
      await withTenant(subdomain, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(workspaces).where(eq(workspaces.subdomain, subdomain));
      });
    }
  } finally {
    await closeDatabase();
  }
});

describe("contact duplicate detection by name (Postgres)", () => {
  it("given child contacts linking their guardians, should report only the guardians", async () => {
    // Arrange
    const ids = ["dup-g1", "dup-g2", "dup-s1", "dup-s2", "dup-x1", "dup-x2"];

    // Act
    const guardians = await contactsRepository.findContactGuardianIds?.(tenant, ids);

    // Assert
    expect([...(guardians ?? [])].sort()).toEqual(["dup-g1", "dup-g2"]);
  });

  it("given same-name contacts, should list the unrelated pair and skip the parent's guardian contacts", async () => {
    // Arrange / Act
    const page = await runWithTenant(tenant, () =>
      contactUseCases.loadContactDuplicatePairsPage({ page: 1, limit: 50 }),
    );

    // Assert
    expect(page.total).toBe(1);
    expect(page.pairs[0]?.reasonKey).toBe("name");
    expect(page.pairs[0]?.contacts.map((c) => String(c.id)).sort()).toEqual(["dup-x1", "dup-x2"]);
  });

  it("given a cold duplicate cache, should count the same pairs on the Potential Duplicates card", async () => {
    // Arrange
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(person("dup-y1", "Unrelated Person")),
    );

    // Act
    const metrics = await runWithTenant(tenant, () => contactUseCases.loadContactsCommandMetrics());

    // Assert
    expect(metrics.duplicatePairCount).toBe(1);
  });

  it("given a same-name contact in another workspace, should not pair across tenants", async () => {
    // Arrange / Act
    const page = await runWithTenant(otherTenant, () =>
      contactUseCases.loadContactDuplicatePairsPage({ page: 1, limit: 50 }),
    );

    // Assert
    expect(page.total).toBe(0);
  });
});
