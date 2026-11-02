import type { FastifyPluginAsync } from "fastify";
import { documentTemplatesContract, type User, roleHasPermission } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import {
  deleteDocumentTemplateUseCase,
  getDocumentTemplateUseCase,
  saveDocumentTemplateUseCase,
} from "../../../documents/use-cases/documentTemplatesUseCases.js";

const s = initServer();

/**
 * Document templates are shared tenant-wide print layouts, so they follow the same
 * privilege as the rest of global settings. Staff write roles (teacher/accountant/…)
 * deliberately do NOT qualify: before this gate every staff role could overwrite any
 * module's layout through the generic `/api/templates/:key` route.
 */
function canModifyDocumentTemplate(user: User | undefined): boolean {
  if (!user || !user.role) return false;
  return roleHasPermission(user.role, "settings.global.write");
}

export const documentTemplatesRouter = s.router(documentTemplatesContract, {
  get: async ({
    params,
    request,
  }: ContractRouteArgs<(typeof documentTemplatesContract)["get"]>): Promise<
    ContractRouteResponse<(typeof documentTemplatesContract)["get"]>
  > => {
    try {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          status: 401 as const,
          body: { type: "unauthorized", message: "Tenant context is required" },
        };
      }
      const stored = await getDocumentTemplateUseCase(tenant, params.key);
      return {
        status: 200 as const,
        body: {
          template: stored?.template ?? null,
          updatedAt: stored?.updatedAt.toISOString() ?? null,
        },
      };
    } catch (err) {
      return handleContractError(request, err, {
        status: 500,
        body: { type: "database_error", message: "Failed to retrieve document template" },
      });
    }
  },

  save: async ({
    params,
    body,
    request,
  }: ContractRouteArgs<(typeof documentTemplatesContract)["save"]>): Promise<
    ContractRouteResponse<(typeof documentTemplatesContract)["save"]>
  > => {
    try {
      const user = request.user as User;
      const tenant = getRequestTenant();
      if (!tenant || !user) {
        return {
          status: 401 as const,
          body: { type: "unauthorized", message: "Authentication required" },
        };
      }
      if (!canModifyDocumentTemplate(user)) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: `You do not have permission to modify document template "${params.key}"`,
          },
        };
      }
      const saved = await saveDocumentTemplateUseCase(
        tenant,
        params.key,
        body.template,
        user,
        body.expectedUpdatedAt,
      );
      return {
        status: 200 as const,
        body: { template: saved.template, updatedAt: saved.updatedAt.toISOString() },
      };
    } catch (err) {
      return handleContractError(request, err, {
        status: 500,
        body: {
          type: "database_error",
          message: `Failed to save document template "${params.key}"`,
        },
      });
    }
  },

  delete: async ({
    params,
    request,
  }: ContractRouteArgs<(typeof documentTemplatesContract)["delete"]>): Promise<
    ContractRouteResponse<(typeof documentTemplatesContract)["delete"]>
  > => {
    try {
      const user = request.user as User;
      const tenant = getRequestTenant();
      if (!tenant || !user) {
        return {
          status: 401 as const,
          body: { type: "unauthorized", message: "Authentication required" },
        };
      }
      if (!canModifyDocumentTemplate(user)) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: `You do not have permission to delete document template "${params.key}"`,
          },
        };
      }
      const deleted = await deleteDocumentTemplateUseCase(tenant, params.key, user);
      return {
        status: 200 as const,
        body: { success: deleted },
      };
    } catch (err) {
      return handleContractError(request, err, {
        status: 500,
        body: {
          type: "database_error",
          message: `Failed to delete document template "${params.key}"`,
        },
      });
    }
  },
} as unknown as RouterImplementation<typeof documentTemplatesContract>);

export const documentTemplatesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticateTenant);
  s.registerRouter(documentTemplatesContract, documentTemplatesRouter, fastify, {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
