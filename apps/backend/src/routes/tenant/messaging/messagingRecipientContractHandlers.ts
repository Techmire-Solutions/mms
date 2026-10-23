import type { User } from "@mms/shared";
import {
  entityResolveBodySchema,
  messagingRecipientsMatchQuerySchema,
  type messagingContract,
} from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadMessaging } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";

function getTenantInfo(request: { tenant?: { id?: string; subdomain?: string } }): {
  id: string;
  subdomain: string;
} {
  const id = request.tenant?.id;
  const subdomain = getRequestTenant() || request.tenant?.subdomain;
  if (!id || !subdomain) throw new Error("Tenant context required");
  return { id: String(id), subdomain: String(subdomain) };
}

export async function messagingListRecipientsHandler({
  query,
  request,
}: ContractRouteArgs<(typeof messagingContract)["listRecipients"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["listRecipients"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const tenant = getTenantInfo(request);
    const result = await withTenant(
      tenant.id,
      () => messagingUseCases.loadMessagingRecipients(tenant.subdomain, query),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to list recipients" },
    };
  }
}

export async function messagingMatchRecipientsHandler({
  query,
  request,
}: ContractRouteArgs<(typeof messagingContract)["matchRecipients"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["matchRecipients"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const parsed = messagingRecipientsMatchQuerySchema.safeParse(query);
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
    const result = await messagingUseCases.matchMessagingRecipients(tenant.subdomain, parsed.data);
    return { status: 200 as const, body: result };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to match recipients" },
    };
  }
}

export async function messagingResolveContactsHandler({
  body,
  request,
}: ContractRouteArgs<(typeof messagingContract)["resolveContacts"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["resolveContacts"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const parsed = entityResolveBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid body",
      },
    };
  }
  try {
    const tenant = getTenantInfo(request);
    const recipients = await messagingUseCases.resolveMessagingRecipients(
      tenant.subdomain,
      parsed.data.ids,
    );
    return { status: 200 as const, body: { recipients } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to resolve contacts" },
    };
  }
}
