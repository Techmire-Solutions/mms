import { appendCollectionAuditInTx } from "../../lib/collectionAuditInTx.js";

/**
 * Contact write audits, appended inside the caller's transaction so the row
 * commits or rolls back with the contact (`mms-data-layer` §5.4).
 */
export async function auditContactPersisted(input: {
  tenant: string;
  contactId: string;
  actorId?: string;
  created: boolean;
  restored: boolean;
}): Promise<void> {
  const action = input.restored
    ? "contact.restore"
    : input.created
      ? "contact.create"
      : "contact.upsert";
  await appendCollectionAuditInTx({
    tenant: input.tenant,
    tableName: "contacts",
    recordId: input.contactId,
    action,
    summary: input.restored
      ? `Restored contact ${input.contactId} via upsert`
      : `${input.created ? "Created" : "Updated"} contact ${input.contactId}`,
    realUserId: input.actorId,
    subjectId: input.contactId,
  });
}

export async function auditContactUpdated(input: {
  tenant: string;
  contactId: string;
  actorId?: string;
}): Promise<void> {
  await appendCollectionAuditInTx({
    tenant: input.tenant,
    tableName: "contacts",
    recordId: input.contactId,
    action: "contact.update",
    summary: `Updated contact ${input.contactId}`,
    realUserId: input.actorId,
    subjectId: input.contactId,
  });
}

/**
 * Merge archives the source contact and re-points every reference, so its audit
 * row must commit with the transaction — a post-commit route summary alone loses
 * the destructive operation if the process dies in between.
 */
export async function auditContactMerged(input: {
  tenant: string;
  keepId: string;
  deleteId: string;
  actorId?: string;
}): Promise<void> {
  await appendCollectionAuditInTx({
    tenant: input.tenant,
    tableName: "contacts",
    recordId: input.keepId,
    action: "contact.merge",
    summary: `Merged contact ${input.deleteId} into ${input.keepId}`,
    realUserId: input.actorId,
    subjectId: input.keepId,
    newState: {
      action: "contact.merge",
      summary: `Merged contact ${input.deleteId} into ${input.keepId}`,
      archivedContactId: input.deleteId,
    },
  });
}

/** Per-contact row for a bulk tag edit; bulk writes must audit each changed record in-tx. */
export async function auditContactBulkTagged(input: {
  tenant: string;
  contactId: string;
  actorId?: string;
  addedTags: string[];
  removedTags: string[];
}): Promise<void> {
  const summary = [
    input.addedTags.length > 0 ? `added [${input.addedTags.join(", ")}]` : "",
    input.removedTags.length > 0 ? `removed [${input.removedTags.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join("; ");
  await appendCollectionAuditInTx({
    tenant: input.tenant,
    tableName: "contacts",
    recordId: input.contactId,
    action: "contact.bulk_tag",
    summary: `Bulk tag ${input.contactId}${summary ? `: ${summary}` : ""}`,
    realUserId: input.actorId,
    subjectId: input.contactId,
  });
}
