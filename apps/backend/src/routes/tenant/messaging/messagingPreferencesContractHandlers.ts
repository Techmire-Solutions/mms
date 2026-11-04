import type { User } from "@mms/shared";
import { type messagingContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { logger } from "../../../lib/logger.js";
import { canReadMessaging, canWriteMessaging } from "../../../services/rbacService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { messagingPreferencesService } from "../../../services/messagingPreferencesService.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";

function logHandlerFailure(operation: string, err: unknown): void {
  logger.error(
    { err: err instanceof Error ? err.message : String(err), operation },
    "messaging preferences handler failed",
  );
}

export async function messagingGetPreferencesHandler({
  request,
}: ContractRouteArgs<(typeof messagingContract)["getPreferences"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["getPreferences"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const preferences = await messagingPreferencesService.load();
    return { status: 200 as const, body: { preferences } };
  } catch (err) {
    logHandlerFailure("getPreferences", err);
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to load messaging preferences" },
    };
  }
}

export async function messagingUpdatePreferencesHandler({
  body,
  request,
}: ContractRouteArgs<(typeof messagingContract)["updatePreferences"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["updatePreferences"]>
> {
  const user = request.user as User;
  if (!canWriteMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const preferences = await messagingPreferencesService.save(body);
    const subdomain = getRequestTenant();
    if (subdomain) {
      // Setup mutations are audited (`mms-module-setup`); a failed audit must not
      // fail the save, so it is recorded best-effort after the write.
      await recordModernAuditEvent({
        workspaceSubdomain: subdomain,
        tableName: "messaging_preferences",
        recordId: "messaging_preferences",
        actionType: "UPDATE",
        realUserId: String(user.id),
        newState: {
          summary: "Updated messaging preferences",
          action: "messaging.preferences.update",
        },
      }).catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "messaging preferences audit failed",
        ),
      );
    }
    return { status: 200 as const, body: { success: true as const, preferences } };
  } catch (err) {
    logHandlerFailure("updatePreferences", err);
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to update messaging preferences" },
    };
  }
}
