import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  resolveStudentGuardianLinks,
  type Contact,
  type ContactWithRelationships,
  type RelationshipContact,
} from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaces } from "../../db/schema.js";
import { contactUseCases } from "../../contacts/use-cases/contactUseCases.js";
import { contactsRepository } from "../../contacts/repository/contactsRepositoryAdapter.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "contacts-relationship-regression";
const keepId = "rel-contact-keep";
const parentId = "rel-contact-parent";
const partnerId = "rel-contact-partner";

function baseContact(id: string, name: string): Contact {
  return { id, firstName: name, lastName: "Khan", name: `${name} Khan` } as Contact;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Contacts relationship test",
      enabled: true,
    });
  });
  await runWithTenant(tenant, () =>
    Promise.all([
      contactUseCases.upsertContact(baseContact(parentId, "Father")),
      contactUseCases.upsertContact(baseContact(partnerId, "Mother")),
    ]),
  );
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

describe("contact relationship persistence (Postgres)", () => {
  it("persists relationship email and gender through save/reload", async () => {
    const relationshipContacts: RelationshipContact[] = [
      {
        contactId: parentId,
        relationship: "Parent",
        phone: "03001112222",
        email: "father@example.com",
        gender: "Male",
      },
      {
        contactId: partnerId,
        relationship: "Parent",
        phone: "03003334444",
        email: "mother@example.com",
        gender: "Female",
      },
    ];

    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(keepId, "Child"),
        relationshipContacts,
      } as Contact),
    );

    const loaded = await runWithTenant(tenant, () => contactUseCases.getContactById(keepId));
    expect(loaded?.relationshipContacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contactId: parentId,
          email: "father@example.com",
          gender: "Male",
        }),
        expect.objectContaining({
          contactId: partnerId,
          email: "mother@example.com",
          gender: "Female",
        }),
      ]),
    );
  });

  it("derives father/mother from persisted gender, not insertion order (R2-05)", async () => {
    const loaded = await runWithTenant(tenant, () => contactUseCases.getContactById(keepId));
    const links = resolveStudentGuardianLinks({}, loaded as ContactWithRelationships);

    // The mother was linked second; gender must still place her in the mother slot.
    expect(links.fatherContactId).toBe(parentId);
    expect(links.motherContactId).toBe(partnerId);
  });

  it("never overwrites a manual reciprocal link and removes stale inferred rows (R2-06)", async () => {
    // Manual link on the parent pointing back at the child.
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(parentId, "Father"),
        relationshipContacts: [{ contactId: keepId, relationship: "Ward", phone: "03001112222" }],
      } as Contact),
    );

    // Child links to the parent: inference must leave the manual "Ward" row alone.
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(keepId, "Child"),
        relationshipContacts: [{ contactId: parentId, relationship: "Parent" }],
      } as Contact),
    );
    const afterManual = await runWithTenant(tenant, () => contactUseCases.getContactById(parentId));
    const manualRow = afterManual?.relationshipContacts?.find(
      (entry) => String(entry.contactId) === keepId,
    );
    expect(manualRow?.relationship).toBe("Ward");
    expect(manualRow?.inferred).not.toBe(true);

    // Remove the child link: the previously inferred row (on the partner) must go.
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(keepId, "Child"),
        relationshipContacts: [{ contactId: partnerId, relationship: "Parent" }],
      } as Contact),
    );
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(keepId, "Child"),
        relationshipContacts: [],
      } as Contact),
    );
    const partner = await runWithTenant(tenant, () => contactUseCases.getContactById(partnerId));
    expect(
      partner?.relationshipContacts?.filter(
        (entry) => String(entry.contactId) === keepId && entry.inferred === true,
      ) ?? [],
    ).toHaveLength(0);
  });

  it("reads trashed contacts only through the include-deleted path (R2-12)", async () => {
    await runWithTenant(tenant, () =>
      contactUseCases.softDeleteContactById(keepId, "u-admin", "relationship test"),
    );

    const activeOnly = await runWithTenant(tenant, () =>
      contactUseCases.getContactById(keepId, false),
    );
    expect(activeOnly).toBeNull();

    const withDeleted = await runWithTenant(tenant, () =>
      contactUseCases.getContactById(keepId, true),
    );
    expect(withDeleted?.deletedAt).toBeTruthy();

    const trashPage = await runWithTenant(tenant, () =>
      contactUseCases.loadContactsPage({ page: 1, limit: 10, includeDeleted: true }),
    );
    expect(trashPage.contacts.map((contact) => String(contact.id))).toContain(keepId);

    const restored = await runWithTenant(tenant, () =>
      contactUseCases.restoreContactById(keepId, "u-admin"),
    );
    expect(restored?.deletedAt).toBeUndefined();

    const rows = await withTenant(tenant, async (tx) => {
      const result = (await tx.execute(
        sql`SELECT policyname, permissive FROM pg_policies WHERE tablename = 'contacts' ORDER BY policyname`,
      )) as unknown as { rows: Array<{ policyname: string; permissive: string }> };
      return result.rows;
    });
    expect(rows).toEqual([
      { policyname: "contacts_tenant_isolation", permissive: "PERMISSIVE" },
      { policyname: "tenant_soft_delete_isolation", permissive: "RESTRICTIVE" },
    ]);
  });

  it("keeps the tenant repository pinned to one workspace", async () => {
    // A different tenant sees nothing even when asking by exact id.
    const other = await contactsRepository.findById("contacts-relationship-other", keepId);
    expect(other).toBeNull();
  });
});
