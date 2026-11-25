import type { User } from "@mms/contracts";
import { MESSAGING_MODULE_MANIFEST, type messagingContract } from "@mms/contracts";
import type { ContractRouteArgs, ContractRouteResponse } from "@mms/be-core/http/routes";
import { logger } from "@mms/be-core/logger";
import { canReadMessaging } from "@mms/be-core/rbac";
import { userHasPermission } from "@mms/be-core/rbac";
import { getRequestTenant } from "@mms/be-core/http";
import { messagingPreferencesService } from "../services/index.js";
import { recordModernAuditEvent } from "@mms/be-core/audit";

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
  // Setup-tier write: the module gate resolves PUT /preferences to `setupWrite`
  // (`settings.global.write`), so the handler mirrors that permission rather than
  // the weaker `messaging.write` (`mms-auth-security` module access gates).
  if (!userHasPermission(user, MESSAGING_MODULE_MANIFEST.permissions.setupWrite)) {
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
