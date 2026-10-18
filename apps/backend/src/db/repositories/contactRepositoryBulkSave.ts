import { and, eq, inArray, sql } from "drizzle-orm";
import { hydrateContactRelationshipFields, type Contact } from "@mms/shared";
import {
  contacts,
  contactPhones,
  contactTags,
  contactEmails,
  contactAddresses,
  contactSocials,
  contactEducations,
  contactExperiences,
  contactSkills,
  contactRelationships,
  contactActivities,
  contactAttachments,
  contactBankDetails,
  students,
  faculty,
  tenantUsers,
} from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { bulkInsertContactChildrenTx } from "./contactRepositoryPersistChildren.js";
import { contactWriteValues } from "./contactRepositoryValues.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export async function bulkSaveContacts(tenant: string, records: Contact[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Contact>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());
  if (uniqueRecords.length === 0) return;

  await withTenant(subdomain, async (tx) => {
    const hydratedRecords = uniqueRecords.map(hydrateContactRelationshipFields);
    const contactIds = hydratedRecords.map((c) => String(c.id));

    await tx
      .insert(contacts)
      .values(hydratedRecords.map((contact) => contactWriteValues(subdomain, contact)))
      .onConflictDoUpdate({
        target: [contacts.workspaceSubdomain, contacts.id],
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          name: sql`excluded.name`,
          gender: sql`excluded.gender`,
          dob: sql`excluded.dob`,
          cnic: sql`excluded.cnic`,
          isSyed: sql`excluded.is_syed`,
          avatar: sql`excluded.avatar`,
          notes: sql`excluded.notes`,
          whatsappStatus: sql`excluded.whatsapp_status`,
          lastCheckedAt: sql`excluded.last_checked_at`,
          aiSummary: sql`excluded.ai_summary`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          restoredAt: sql`excluded.restored_at`,
          restoredBy: sql`excluded.restored_by`,
          updatedAt: new Date(),
          updatedBy: sql`excluded.updated_by`,
        },
      });

    await Promise.all([
      tx
        .delete(contactPhones)
        .where(
          and(
            eq(contactPhones.workspaceSubdomain, subdomain),
            inArray(contactPhones.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactTags)
        .where(
          and(
            eq(contactTags.workspaceSubdomain, subdomain),
            inArray(contactTags.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactEmails)
        .where(
          and(
            eq(contactEmails.workspaceSubdomain, subdomain),
            inArray(contactEmails.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactAddresses)
        .where(
          and(
            eq(contactAddresses.workspaceSubdomain, subdomain),
            inArray(contactAddresses.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactSocials)
        .where(
          and(
            eq(contactSocials.workspaceSubdomain, subdomain),
            inArray(contactSocials.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactEducations)
        .where(
          and(
            eq(contactEducations.workspaceSubdomain, subdomain),
            inArray(contactEducations.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactExperiences)
        .where(
          and(
            eq(contactExperiences.workspaceSubdomain, subdomain),
            inArray(contactExperiences.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactSkills)
        .where(
          and(
            eq(contactSkills.workspaceSubdomain, subdomain),
            inArray(contactSkills.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactRelationships)
        .where(
          and(
            eq(contactRelationships.workspaceSubdomain, subdomain),
            inArray(contactRelationships.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactActivities)
        .where(
          and(
            eq(contactActivities.workspaceSubdomain, subdomain),
            inArray(contactActivities.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactAttachments)
        .where(
          and(
            eq(contactAttachments.workspaceSubdomain, subdomain),
            inArray(contactAttachments.contactId, contactIds),
          ),
        ),
      tx
        .delete(contactBankDetails)
        .where(
          and(
            eq(contactBankDetails.workspaceSubdomain, subdomain),
            inArray(contactBankDetails.contactId, contactIds),
          ),
        ),
    ]);

    await bulkInsertContactChildrenTx(tx, subdomain, hydratedRecords);
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
}

export async function replaceContactsForWorkspace(
  tenant: string,
  records: Contact[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, Contact>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .update(students)
      .set({
        contactId: null,
        fatherContactId: null,
        motherContactId: null,
        guardianContactId: null,
      })
      .where(eq(students.workspaceSubdomain, subdomain));
    await tx.delete(faculty).where(eq(faculty.workspaceSubdomain, subdomain));
    await tx
      .update(tenantUsers)
      .set({ contactId: null })
      .where(eq(tenantUsers.workspaceSubdomain, subdomain));
    await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, subdomain));
    if (uniqueRecords.length === 0) return;

    const hydratedRecords = uniqueRecords.map(hydrateContactRelationshipFields);
    await tx
      .insert(contacts)
      .values(hydratedRecords.map((contact) => contactWriteValues(subdomain, contact)));

    await bulkInsertContactChildrenTx(tx, subdomain, hydratedRecords);
  });
  await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
}
