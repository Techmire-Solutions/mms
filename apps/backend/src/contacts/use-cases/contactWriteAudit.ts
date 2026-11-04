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
