import type { User } from "@mms/shared";
import { type messagingContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadMessaging, canWriteMessaging } from "../../../services/rbacService.js";
import { messagingPreferencesService } from "../../../services/messagingPreferencesService.js";

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
  } catch {
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
    return { status: 200 as const, body: { success: true as const, preferences } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to update messaging preferences" },
    };
  }
}
