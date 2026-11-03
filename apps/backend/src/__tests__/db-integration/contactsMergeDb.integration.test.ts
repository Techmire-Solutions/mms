import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  workspaces,
  contacts,
  facultyEmployments,
  workshopEvents,
  workshopParticipants,
  financeInvoices,
} from "../../db/schema.js";
import { contactUseCases } from "../../contacts/use-cases/contactUseCases.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres coverage for contact merge (R4-01, R4-02, R4-05).
 *
 * The unit suite drives merge through a fake repository, so the re-parenting SQL
 * and the child-collection persistence were never executed — that is exactly how
 * a statement against the dropped `faculty.contact_id` column shipped.
 */
const tenant = "contacts-merge-regression";
const keepId = "merge-contact-keep";
const otherId = "merge-contact-other";
const workshopId = "merge-workshop";
const invoiceId = "merge-invoice";

function baseContact(id: string, name: string, phone: string, email: string): Contact {
  return {
    id,
    firstName: name,
    lastName: "Khan",
    name: `${name} Khan`,
    phones: [{ number: phone, label: "Mobile", isPrimary: true }],
    emails: [{ address: email, label: "Personal", isPrimary: true }],
  } as Contact;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Contacts merge test",
      enabled: true,
    });
  });
  await runWithTenant(tenant, async () => {
    await contactUseCases.upsertContact(baseContact(keepId, "Aisha", "3001000001", "keep@x.com"));
    await contactUseCases.upsertContact(
      baseContact(otherId, "Ayesha", "3001000002", "other@x.com"),
    );
  });
  // References owned by other modules that must all follow the survivor.
  await withTenant(tenant, async (tx) => {
    await tx.insert(workshopEvents).values({
      id: workshopId,
      workspaceSubdomain: tenant,
      title: "Merge workshop",
    });
    await tx.insert(workshopParticipants).values({
      id: "merge-participant",
      workspaceSubdomain: tenant,
      workshopId,
      contactId: otherId,
      status: "attended",
    });
    await tx.insert(facultyEmployments).values({
      id: "merge-employment",
      workspaceSubdomain: tenant,
      contactId: otherId,
      status: "active",
    });
    await tx.insert(financeInvoices).values({
      id: invoiceId,
      workspaceSubdomain: tenant,
      studentId: "merge-student",
      dueDate: "2026-12-01",
      familyContactId: otherId,
    });
  });
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

async function loadEmployments(workspace: string) {
  return withTenant(workspace, async (tx) =>
    tx
      .select({
        id: facultyEmployments.id,
        contactId: facultyEmployments.contactId,
        deletedAt: facultyEmployments.deletedAt,
        reason: facultyEmployments.deletionReason,
      })
      .from(facultyEmployments)
      .where(eq(facultyEmployments.workspaceSubdomain, workspace)),
  );
}

describe("contact merge (Postgres)", () => {
  it("re-parents every contact reference and keeps both child collections", async () => {
    const merged = await runWithTenant(tenant, () =>
      contactUseCases.mergeContactsById(keepId, otherId, undefined, "u-admin"),
    );

    expect(merged.id).toBe(keepId);
    expect(merged.phones?.map((phone) => phone.number).sort()).toEqual([
      "3001000001",
      "3001000002",
    ]);
    expect(merged.emails?.map((email) => email.address).sort()).toEqual([
      "keep@x.com",
      "other@x.com",
    ]);

    const references = await withTenant(tenant, async (tx) => {
      const participants = await tx
        .select({ id: workshopParticipants.id, contactId: workshopParticipants.contactId })
        .from(workshopParticipants)
        .where(eq(workshopParticipants.workspaceSubdomain, tenant));
      const invoices = await tx
        .select({ familyContactId: financeInvoices.familyContactId })
        .from(financeInvoices)
        .where(eq(financeInvoices.id, invoiceId));
      return { participants, invoices };
    });

    expect(references.participants).toEqual([{ id: "merge-participant", contactId: keepId }]);
    expect(references.invoices).toEqual([{ familyContactId: keepId }]);

    const employments = await loadEmployments(tenant);
    expect(employments).toEqual([
      { id: "merge-employment", contactId: keepId, deletedAt: null, reason: null },
    ]);

    // The merged-away contact is archived, not deleted.
    const other = await runWithTenant(tenant, () => contactUseCases.getContactById(otherId, true));
    expect(other?.deletedAt).toBeTruthy();
  });

  it("archives a conflicting faculty employment instead of violating the unique index", async () => {
    const thirdId = "merge-contact-third";
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(thirdId, "Aysha", "3001000003", "third@x.com")),
    );
    await withTenant(tenant, async (tx) => {
      await tx.insert(facultyEmployments).values({
        id: "merge-employment-third",
        workspaceSubdomain: tenant,
        contactId: thirdId,
        status: "active",
      });
    });

    // The survivor already holds an active employment, so the loser's row has to
    // be archived before it can be re-pointed (unique partial index).
    await runWithTenant(tenant, () =>
      contactUseCases.mergeContactsById(keepId, thirdId, undefined, "u-admin"),
    );

    const rows = await loadEmployments(tenant);
    const active = rows.filter((row) => row.deletedAt === null);
    expect(active).toHaveLength(1);
    expect(active[0]?.contactId).toBe(keepId);
    expect(rows.every((row) => row.contactId === keepId)).toBe(true);
    const archivedThird = rows.find((row) => row.id === "merge-employment-third");
    expect(archivedThird?.deletedAt).toBeTruthy();
    expect(archivedThird?.reason).toContain("Merged into");
  });

  it("treats the merge body as a patch, never as a whole-record replacement", async () => {
    const patchId = "merge-contact-patch";
    const loserId = "merge-contact-patch-loser";
    await runWithTenant(tenant, async () => {
      await contactUseCases.upsertContact(baseContact(patchId, "Bilal", "3001000010", "b@x.com"));
      await contactUseCases.upsertContact(baseContact(loserId, "Belal", "3001000011", "bl@x.com"));
    });

    const merged = await runWithTenant(tenant, () =>
      contactUseCases.mergeContactsById(
        patchId,
        loserId,
        // A partial `merged` body (the UI always sends one) must not clear the
        // survivor's collections.
        { firstName: "Bilal", name: "Bilal Ahmed" } as Contact,
        "u-admin",
      ),
    );

    expect(merged.phones?.map((phone) => phone.number)).toEqual(["3001000010"]);
    expect(merged.emails?.map((email) => email.address)).toEqual(["b@x.com"]);
  });

  it("rejects a stale merge snapshot without mutating either contact", async () => {
    const keep = await runWithTenant(tenant, () => contactUseCases.getContactById(keepId));
    const staleId = "merge-contact-stale";
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(staleId, "Sana", "3001000020", "s@x.com")),
    );

    await expect(
      runWithTenant(tenant, () =>
        contactUseCases.mergeContactsById(keepId, staleId, undefined, "u-admin", {
          expectedKeepUpdatedAt: "2000-01-01T00:00:00.000Z",
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const survivor = await runWithTenant(tenant, () => contactUseCases.getContactById(keepId));
    expect(survivor?.updatedAt).toBe(keep?.updatedAt);
    const stillThere = await runWithTenant(tenant, () => contactUseCases.getContactById(staleId));
    expect(stillThere?.deletedAt ?? null).toBeNull();
  });
});

describe("contact write guards (Postgres)", () => {
  it("keeps the stored phones when a write patch omits them", async () => {
    const id = "merge-contact-omit";
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(id, "Hina", "3001000030", "h@x.com")),
    );

    await runWithTenant(tenant, () =>
      // A create-style upsert with no `phones` key must not clear the collection.
      contactUseCases.upsertContact({ id, firstName: "Hina", name: "Hina Khan" } as Contact),
    );

    const loaded = await runWithTenant(tenant, () => contactUseCases.getContactById(id));
    expect(loaded?.phones?.map((phone) => phone.number)).toEqual(["3001000030"]);
  });

  it("still clears a collection when the patch sends an explicit empty array", async () => {
    const id = "merge-contact-clear";
    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact(baseContact(id, "Imran", "3001000031", "i@x.com")),
    );

    await runWithTenant(tenant, () =>
      contactUseCases.upsertContact({
        ...baseContact(id, "Imran", "3001000031", "i@x.com"),
        phones: [],
      }),
    );

    const loaded = await runWithTenant(tenant, () => contactUseCases.getContactById(id));
    expect(loaded?.phones ?? []).toEqual([]);
  });

  it("keeps exactly one workshop registration after the merge", async () => {
    const rows = await withTenant(tenant, async (tx) =>
      tx
        .select({ id: workshopParticipants.id })
        .from(workshopParticipants)
        .where(
          and(
            eq(workshopParticipants.workspaceSubdomain, tenant),
            isNull(workshopParticipants.deletedAt),
          ),
        ),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("merge reference repair migration (0203)", () => {
  const repairSql = readFileSync(
    new URL(
      "../../db/migrations_drizzle/0203_contacts_merge_reference_repair.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("re-points references left behind by a pre-fix merge", async () => {
    const survivorId = "repair-survivor";
    const loserId = "repair-loser";
    await runWithTenant(tenant, async () => {
      await contactUseCases.upsertContact(
        baseContact(survivorId, "Survivor", "3001000050", "s@x.com"),
      );
      await contactUseCases.upsertContact(baseContact(loserId, "Loser", "3001000051", "l@x.com"));
    });
    await withTenant(tenant, async (tx) => {
      // Simulate the state the old merge left: an archived loser named in
      // `deletion_reason`, plus references still pointing at it.
      await tx
        .update(contacts)
        .set({
          deletedAt: new Date(),
          deletionReason: `Merged into ${survivorId}`,
        })
        .where(and(eq(contacts.workspaceSubdomain, tenant), eq(contacts.id, loserId)));
      await tx.insert(facultyEmployments).values({
        id: "repair-employment",
        workspaceSubdomain: tenant,
        contactId: loserId,
        status: "active",
      });
      await tx.insert(workshopParticipants).values({
        id: "repair-participant",
        workspaceSubdomain: tenant,
        workshopId,
        contactId: loserId,
        status: "registered",
      });
      await tx.insert(financeInvoices).values({
        id: "repair-invoice",
        workspaceSubdomain: tenant,
        studentId: "merge-student",
        dueDate: "2026-12-02",
        familyContactId: loserId,
      });

      // Run the migration statements in order (breakpoints strip the framing).
      const statements = repairSql
        .split("--> statement-breakpoint")
        .map((chunk) => chunk.replace(/^--.*$/gm, "").trim())
        .filter(Boolean);
      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }
    });

    const state = await withTenant(tenant, async (tx) => {
      const employment = await tx
        .select({ contactId: facultyEmployments.contactId })
        .from(facultyEmployments)
        .where(eq(facultyEmployments.id, "repair-employment"));
      const participant = await tx
        .select({ contactId: workshopParticipants.contactId })
        .from(workshopParticipants)
        .where(eq(workshopParticipants.id, "repair-participant"));
      const invoice = await tx
        .select({ familyContactId: financeInvoices.familyContactId })
        .from(financeInvoices)
        .where(eq(financeInvoices.id, "repair-invoice"));
      return { employment, participant, invoice };
    });

    expect(state.employment[0]?.contactId).toBe(survivorId);
    expect(state.participant[0]?.contactId).toBe(survivorId);
    expect(state.invoice[0]?.familyContactId).toBe(survivorId);
  });
});
