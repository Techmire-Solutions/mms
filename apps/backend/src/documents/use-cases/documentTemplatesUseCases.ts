import { documentTemplateSchema, type DocumentTemplate, type User } from "@mms/shared";
import { documentsRepositoryAdapter } from "../repository/documentsRepositoryAdapter.js";
import { broadcastCollection, broadcastTenantUpdate } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";

export async function getDocumentTemplateUseCase(
  tenant: string,
  key: string,
): Promise<DocumentTemplate | null> {
  // `document_templates` is FORCE ROW LEVEL SECURITY: without a tenant-scoped
  // transaction the lookup sees no rows at all under a non-bypass role. The
  // repository uses `activeDb()`, so it joins this transaction.
  return await withTenantRead(tenant, () => documentsRepositoryAdapter.getTemplate(tenant, key));
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

  // Save and audit share one tenant transaction; broadcasts are emitted only
  // after it commits, so a failed write cannot invalidate clients.
  const saved = await withTenant(tenant, async () => {
    const stored = await documentsRepositoryAdapter.saveTemplate(tenant, key, parsed.data);

    // Modern RFC 8785 canonical audit log entry (joins the active transaction).
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "document_templates",
      recordId: key,
      actionType: "UPDATE",
      realUserId: String(user.id),
    });

    return stored;
  });

  // Live WebSocket broadcast for instant cross-tab / cross-device invalidation
  await broadcastCollection("document_templates");
  broadcastTenantUpdate(tenant, "object", key);

  return saved;
}

export async function deleteDocumentTemplateUseCase(
  tenant: string,
  key: string,
  user: User,
): Promise<boolean> {
  const deleted = await withTenant(tenant, async () => {
    const removed = await documentsRepositoryAdapter.deleteTemplate(tenant, key);
    if (!removed) return false;

    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "document_templates",
      recordId: key,
      actionType: "DELETE",
      realUserId: String(user.id),
    });
    return true;
  });

  if (deleted) {
    await broadcastCollection("document_templates");
    broadcastTenantUpdate(tenant, "object", key);
  }

  return deleted;
}
