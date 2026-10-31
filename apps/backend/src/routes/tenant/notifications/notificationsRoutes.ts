import type { FastifyInstance, FastifyRequest } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { notificationsContract, type User } from "@mms/shared";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";
import { notificationsUseCases } from "../../../notifications/use-cases/notificationsUseCases.js";

type Contract = typeof notificationsContract;
const s = initServer();

/**
 * App-shell notifications. Not module-owned: any signed-in tenant user may call these, and the
 * use-cases filter every row by the caller's own permissions, so nobody sees (or can mark) a
 * notification addressed to a permission their role lacks.
 */
async function run<T>(
  request: FastifyRequest,
  failure: string,
  work: (tenant: string, user: User) => Promise<T>,
): Promise<T | { status: number; body: { type: string; message: string } }> {
  try {
    return await work(String(request.tenant?.id ?? ""), request.user as User);
  } catch (error) {
    if (error instanceof HttpDomainError) {
      return { status: error.statusCode, body: { type: error.type, message: error.message } };
    }
    return handleContractError(request, error, {
      status: 500,
      body: { type: "server_error", message: failure },
    });
  }
}

export default async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  const router = s.router(notificationsContract, {
    listNotifications: async ({ request }: ContractRouteArgs<Contract["listNotifications"]>) =>
      run(request, "Failed to load notifications", async (tenant, user) => ({
        status: 200 as const,
        body: await notificationsUseCases.list(tenant, user),
      })),
    markNotificationRead: async ({
      params,
      request,
    }: ContractRouteArgs<Contract["markNotificationRead"]>) =>
      run(request, "Failed to update the notification", async (tenant, user) => {
        await notificationsUseCases.markRead(tenant, user, params.id);
        return { status: 200 as const, body: { success: true as const } };
      }),
    markAllNotificationsRead: async ({
      request,
    }: ContractRouteArgs<Contract["markAllNotificationsRead"]>) =>
      run(request, "Failed to update notifications", async (tenant, user) => {
        await notificationsUseCases.markAllRead(tenant, user);
        return { status: 200 as const, body: { success: true as const } };
      }),
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
}
