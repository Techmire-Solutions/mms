import { and, eq } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import {
  contactRelationships,
  contactActivities,
  contactAttachments,
  contactBankDetails,
} from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { requireDbDateValue } from "../../lib/dbDate.js";

type Transaction = TenantTransaction;

export async function syncContactEngagementChildrenTx(
  tx: Transaction,
  subdomain: string,
  contactId: string,
  contact: Contact,
): Promise<void> {
  await tx
    .delete(contactRelationships)
    .where(
      and(
        eq(contactRelationships.workspaceSubdomain, subdomain),
        eq(contactRelationships.contactId, contactId),
      ),
    );
  const relationships = contact.relationshipContacts ?? [];
  if (relationships.length > 0) {
    await tx.insert(contactRelationships).values(
      relationships.map((r, idx) => ({
        id: `rel-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        relatedContactId: r.contactId ? String(r.contactId) : null,
        name: r.name ?? null,
        relationship: r.relationship ?? null,
        phone: r.phone ?? null,
        inferred: r.inferred ?? false,
        inferredFromContactId: r.inferredFromContactId ? String(r.inferredFromContactId) : null,
        inferenceDepth: r.inferenceDepth ?? 0,
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactActivities)
    .where(
      and(
        eq(contactActivities.workspaceSubdomain, subdomain),
        eq(contactActivities.contactId, contactId),
      ),
    );
  if (contact.activities && contact.activities.length > 0) {
    await tx.insert(contactActivities).values(
      contact.activities.map((act, idx) => ({
        id: act.id || `act-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        type: act.type,
        content: act.content,
        date: requireDbDateValue(act.date, "date"),
        by: act.by ?? null,
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactAttachments)
    .where(
      and(
        eq(contactAttachments.workspaceSubdomain, subdomain),
        eq(contactAttachments.contactId, contactId),
      ),
    );
  if (contact.attachments && contact.attachments.length > 0) {
    await tx.insert(contactAttachments).values(
      contact.attachments.map((att, idx) => ({
        id: att.id || `att-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        name: att.name,
        type: att.type,
        size: att.size ?? 0,
        url: att.url,
        date: requireDbDateValue(att.date, "date"),
        sortOrder: idx,
      })),
    );
  }

  await tx
    .delete(contactBankDetails)
    .where(
      and(
        eq(contactBankDetails.workspaceSubdomain, subdomain),
        eq(contactBankDetails.contactId, contactId),
      ),
    );
  if (contact.bankDetails && contact.bankDetails.length > 0) {
    await tx.insert(contactBankDetails).values(
      contact.bankDetails.map((b, idx) => ({
        id: b.id || `bnk-${idx + 1}`,
        workspaceSubdomain: subdomain,
        contactId,
        bankName: b.bankName ?? null,
        accountTitle: b.accountTitle ?? null,
        accountNumber: b.accountNumber ?? null,
        sortOrder: b.sortOrder ?? idx,
      })),
    );
  }
}

export async function bulkInsertContactEngagementChildrenTx(
  tx: Transaction,
  subdomain: string,
  rawContacts: Contact[],
): Promise<void> {
  const allRelationships = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.relationshipContacts ?? []).map((r, idx) => ({
      id: `rel-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      relatedContactId: r.contactId ? String(r.contactId) : null,
      name: r.name ?? null,
      relationship: r.relationship ?? null,
      phone: r.phone ?? null,
      inferred: r.inferred ?? false,
      inferredFromContactId: r.inferredFromContactId ? String(r.inferredFromContactId) : null,
      inferenceDepth: r.inferenceDepth ?? 0,
      sortOrder: idx,
    }));
  });
  if (allRelationships.length > 0) await tx.insert(contactRelationships).values(allRelationships);

  const allActivities = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.activities ?? []).map((act, idx) => ({
      id: act.id || `act-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      type: act.type,
      content: act.content,
      date: requireDbDateValue(act.date, "date"),
      by: act.by ?? null,
      sortOrder: idx,
    }));
  });
  if (allActivities.length > 0) await tx.insert(contactActivities).values(allActivities);

  const allAttachments = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.attachments ?? []).map((att, idx) => ({
      id: att.id || `att-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      name: att.name,
      type: att.type,
      size: att.size ?? 0,
      url: att.url,
      date: requireDbDateValue(att.date, "date"),
      sortOrder: idx,
    }));
  });
  if (allAttachments.length > 0) await tx.insert(contactAttachments).values(allAttachments);

  const allBankDetails = rawContacts.flatMap((c) => {
    const contactId = String(c.id);
    return (c.bankDetails ?? []).map((b, idx) => ({
      id: b.id || `bnk-${contactId}-${idx + 1}`,
      workspaceSubdomain: subdomain,
      contactId,
      bankName: b.bankName ?? null,
      accountTitle: b.accountTitle ?? null,
      accountNumber: b.accountNumber ?? null,
      sortOrder: b.sortOrder ?? idx,
    }));
  });
  if (allBankDetails.length > 0) await tx.insert(contactBankDetails).values(allBankDetails);
}
