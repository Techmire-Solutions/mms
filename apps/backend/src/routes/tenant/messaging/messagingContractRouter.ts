import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { messagingContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadMessaging } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";

const s = initServer();

function requireMessagingTenant(request: { tenant?: { id?: string; subdomain?: string } }): {
  id: string;
  subdomain: string;
} {
  const id = request.tenant?.id;
  const subdomain = getRequestTenant() || request.tenant?.subdomain;
  if (!id || !subdomain) {
    throw new Error("Tenant context required");
  }
  return { id: String(id), subdomain: String(subdomain) };
}

export const messagingContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(messagingContract, {
    listLogs: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof messagingContract)["listLogs"]>): Promise<
      ContractRouteResponse<(typeof messagingContract)["listLogs"]>
    > => {
      const user = request.user as User;
      if (!canReadMessaging(user)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const tenant = requireMessagingTenant(request);
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
    },
    listTemplates: async ({
      request,
    }: ContractRouteArgs<(typeof messagingContract)["listTemplates"]>): Promise<
      ContractRouteResponse<(typeof messagingContract)["listTemplates"]>
    > => {
      const user = request.user as User;
      if (!canReadMessaging(user)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const templates = await withTenant(
          String(request.tenant?.id),
          () => messagingUseCases.loadMessageTemplates(),
          { readOnly: true },
        );
        return { status: 200 as const, body: { templates } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list messaging templates" },
        };
      }
    },
    listRecipients: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof messagingContract)["listRecipients"]>): Promise<
      ContractRouteResponse<(typeof messagingContract)["listRecipients"]>
    > => {
      const user = request.user as User;
      if (!canReadMessaging(user)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const tenant = requireMessagingTenant(request);
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
    },
  } as unknown as RouterImplementation<typeof messagingContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
