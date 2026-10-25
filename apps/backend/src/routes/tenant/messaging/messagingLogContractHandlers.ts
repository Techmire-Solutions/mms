import type { User } from "@mms/shared";
import {
  isQueryFlagTrue,
  messagingMetricsQuerySchema,
  recordMessageLogsSchema,
  type messagingContract,
} from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canClearMessagingLogs, canReadMessaging, canRestoreMessagingLogs } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";
import { emitOutboxEvent } from "../../../services/outboxEventService.js";
import { logger } from "../../../lib/logger.js";
import { processRecordMessageLogs } from "./messagingLogRecordHandler.js";

function getTenantInfo(request: { tenant?: { id?: string; subdomain?: string } }): {
  id: string;
  subdomain: string;
} {
  const id = request.tenant?.id;
  const subdomain = getRequestTenant() || request.tenant?.subdomain;
  if (!id || !subdomain) throw new Error("Tenant context required");
  return { id: String(id), subdomain: String(subdomain) };
}

export async function messagingListLogsHandler({
  query,
  request,
}: ContractRouteArgs<(typeof messagingContract)["listLogs"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["listLogs"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const includeDeleted =
    query &&
    "includeDeleted" in query &&
    isQueryFlagTrue((query as Record<string, unknown>).includeDeleted);
  if (includeDeleted && !canClearMessagingLogs(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const tenant = getTenantInfo(request);
    const result = await withTenant(
      tenant.id,
      () => messagingUseCases.loadFilteredMessageLogs(tenant.subdomain, query),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to list message logs" },
    };
  }
}

export async function messagingGetMetricsHandler({
  query,
  request,
}: ContractRouteArgs<(typeof messagingContract)["getMetrics"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["getMetrics"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const parsed = messagingMetricsQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid query",
      },
    };
  }
  try {
    const tenant = getTenantInfo(request);
    const metrics = await withTenant(
      tenant.id,
      () =>
        messagingUseCases.computeMessagingMetrics(tenant.subdomain, {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        }),
      { readOnly: true },
    );
    return { status: 200 as const, body: { metrics } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to load messaging metrics" },
    };
  }
}

export async function messagingRecordLogsHandler({
  body,
  headers,
  request,
}: ContractRouteArgs<(typeof messagingContract)["recordLogs"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["recordLogs"]>
> {
  const user = request.user as User;
  const parsed = recordMessageLogsSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid body",
      },
    };
  }
  let tenantSubdomain: string;
  try {
    tenantSubdomain = getTenantInfo(request).subdomain;
  } catch {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Tenant context required" },
    };
  }

  const result = await processRecordMessageLogs(
    user,
    tenantSubdomain,
    parsed.data,
    (headers as Record<string, string | undefined> | undefined)?.["idempotency-key"],
  );

  if (result.status === 200) {
    return { status: 200 as const, body: result.body as { recorded: number } };
  }
  if (result.status === 400) {
    return { status: 400 as const, body: result.body };
  }
  if (result.status === 403) {
    return { status: 403 as const, body: result.body };
  }
  if (result.status === 409) {
    return { status: 409 as const, body: result.body };
  }
  return { status: 500 as const, body: result.body };
}

export async function messagingClearLogsHandler({
  request,
}: ContractRouteArgs<(typeof messagingContract)["clearLogs"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["clearLogs"]>
> {
  const user = request.user as User;
  if (!canClearMessagingLogs(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  let tenantSubdomain: string;
  try {
    tenantSubdomain = getTenantInfo(request).subdomain;
  } catch {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Tenant context required" },
    };
  }

  try {
    await messagingUseCases.clearAllMessageLogs(tenantSubdomain);
    void recordModernAuditEvent({
      workspaceSubdomain: tenantSubdomain,
      tableName: "message_logs",
      recordId: "message_logs",
      actionType: "DELETE",
      realUserId: String(user.id),
      newState: {
        summary: "Soft-archived all message logs from Reports",
        action: "messaging.logs.clear",
      },
    }).catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "audit event append failed",
      ),
    );
    return { status: 200 as const, body: { success: true as const } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to clear message logs" },
    };
  }
}

/** Handles POST /api/messaging/logs/restore — un-soft-archives archived logs. */
export async function messagingRestoreLogsHandler({
  body,
  request,
}: ContractRouteArgs<(typeof messagingContract)["restoreLogs"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["restoreLogs"]>
> {
  const user = request.user as User;
  if (!canRestoreMessagingLogs(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  let tenantSubdomain: string;
  try {
    tenantSubdomain = getTenantInfo(request).subdomain;
  } catch {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Tenant context required" },
    };
  }

  const requestedIds = Array.isArray(body?.ids)
    ? body.ids.map((id: unknown) => String(id))
    : undefined;

  try {
    const restoredCount = await messagingUseCases.restoreMessageLogs(
      tenantSubdomain,
      String(user.id),
      requestedIds,
    );

    if (restoredCount > 0) {
      void emitOutboxEvent("entity.restored", {
        entityType: "message_logs",
        entityId: "message_logs",
        tenantId: tenantSubdomain,
        restoredAt: new Date().toISOString(),
        restoredBy: String(user.id),
        version: Date.now(),
      }).catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "outbox event emit failed",
        ),
      );
      void recordModernAuditEvent({
        workspaceSubdomain: tenantSubdomain,
        tableName: "message_logs",
        recordId: "message_logs",
        actionType: "RESTORE",
        realUserId: String(user.id),
        newState: {
          summary: `Restored archived message logs (${restoredCount} restored)`,
          action: "messaging.logs.restore",
        },
      }).catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "audit event append failed",
        ),
      );
    }

    return { status: 200 as const, body: { restored: restoredCount } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to restore message logs" },
    };
  }
}
