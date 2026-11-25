import type { User } from "@mms/contracts";
import { getRequestTenant } from "@mms/be-core/http";
import { type DbOrTransaction, recordModernAuditEvent } from "@mms/be-core/audit";
import { mapActionStringToAuditType } from "@mms/be-core/audit";
import { logger } from "@mms/be-core/logger";

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
 * Shared collection-audit helper factory (contacts copy). Route helpers reduce
 * to `createCollectionAuditHelper('contacts')`. Supports transactional outbox
 * logging when `options.tx` is passed.
 */
export function createCollectionAuditHelper(
  defaultEntityId: string,
  helperOptions?: { subjectScoped?: boolean; strict?: boolean },
) {
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
      ...(helperOptions?.subjectScoped ? { subjectId: entityId } : {}),
    };

    const auditPromise = options?.tx
      ? recordModernAuditEvent(options.tx, auditInput)
      : recordModernAuditEvent(auditInput);

    if (helperOptions?.strict) {
      await auditPromise;
      return;
    }

    await auditPromise.catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "audit event append failed",
      ),
    );
  };
}
