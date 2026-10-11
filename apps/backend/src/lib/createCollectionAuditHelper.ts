import type { User } from "@mms/shared";
import { getRequestTenant } from "./tenantContext.js";
import {
  recordModernAuditEvent,
  mapActionStringToAuditType,
  type DbOrTransaction,
} from "../services/auditTrailService.js";
import { logger } from "./logger.js";

export interface CollectionAuditExtraOptions {
  tx?: DbOrTransaction;
  oldState?: unknown;
  newState?: unknown;
  minimizeDelta?: boolean;
  correlationId?: string;
  ipAddress?: string;
  apiEndpoint?: string;
  httpMethod?: string;
}

/**
 * Shared collection-audit helper factory. Module route helpers (Faculty/Students/Users/
 * Sessions/Contacts/Enrollments) each reduce to `createCollectionAuditHelper('faculty')`.
 * Supports transactional outbox logging when `options.tx` is passed.
 */
export function createCollectionAuditHelper(defaultEntityId: string) {
  return async function auditCollectionAction(
    user: User,
    action: string,
    summary: string,
    entityId = defaultEntityId,
    options?: CollectionAuditExtraOptions,
  ): Promise<void> {
    const tenant = getRequestTenant();
    if (!tenant) return;
    const actionType = mapActionStringToAuditType(action);
    const resolvedNewState =
      options?.newState !== undefined
        ? options.newState
        : summary
          ? { summary, action }
          : { action };

    const auditInput = {
      workspaceSubdomain: tenant,
      tableName: defaultEntityId,
      recordId: entityId,
      actionType,
      realUserId: String(user.id),
      oldState: options?.oldState,
      newState: resolvedNewState,
      minimizeDelta: options?.minimizeDelta,
      correlationId: options?.correlationId,
      ipAddress: options?.ipAddress,
      apiEndpoint: options?.apiEndpoint,
      httpMethod: options?.httpMethod,
    };

    const auditPromise = options?.tx
      ? recordModernAuditEvent(options.tx, auditInput)
      : recordModernAuditEvent(auditInput);

    await auditPromise.catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "audit event append failed",
      ),
    );
  };
}
