import { documentTemplateSchema, type DocumentTemplate, type User } from "@mms/shared";
import { documentsRepositoryAdapter } from "../repository/documentsRepositoryAdapter.js";
import { broadcastCollection, broadcastTenantUpdate } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

export async function getDocumentTemplateUseCase(
  tenant: string,
  key: string,
): Promise<DocumentTemplate | null> {
  return await documentsRepositoryAdapter.getTemplate(tenant, key);
}

export async function saveDocumentTemplateUseCase(
  tenant: string,
  key: string,
  template: DocumentTemplate,
  user: User,
): Promise<DocumentTemplate> {
  const parsed = documentTemplateSchema.safeParse(template);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new TypeError(`Cannot save invalid document template: ${detail}`);
  }

  const saved = await documentsRepositoryAdapter.saveTemplate(tenant, key, parsed.data);

  // Live WebSocket broadcast for instant cross-tab / cross-device invalidation
  await broadcastCollection("document_templates");
  broadcastTenantUpdate(tenant, "object", key);

  // Modern RFC 8785 canonical audit log entry
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "document_templates",
    recordId: key,
    actionType: "UPDATE",
    realUserId: String(user.id),
  });

  return saved;
}

export async function deleteDocumentTemplateUseCase(
  tenant: string,
  key: string,
  user: User,
): Promise<boolean> {
  const deleted = await documentsRepositoryAdapter.deleteTemplate(tenant, key);

  if (deleted) {
    await broadcastCollection("document_templates");
    broadcastTenantUpdate(tenant, "object", key);

    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "document_templates",
      recordId: key,
      actionType: "DELETE",
      realUserId: String(user.id),
    });
  }

  return deleted;
}
