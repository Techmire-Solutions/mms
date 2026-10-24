import type { FastifyPluginAsync } from "fastify";
import {
  isQueryFlagTrue,
  type User,
  obligationContract,
  OBLIGATIONS_MODULE_MANIFEST,
  normalizeObligationsModulePreferences,
  roleHasPermission,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canDeleteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { obligationsUseCases } from "../../../obligations/use-cases/obligationsUseCases.js";
import {
  getObligationPreferencesService,
  updateObligationPreferencesService,
} from "../../../services/obligationPreferencesService.js";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";

const auditObligations = createCollectionAuditHelper("obligation_collections");
const s = initServer();

export const obligationContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(obligationContract, {
    listCollections: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof obligationContract)["listCollections"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["listCollections"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "obligation_collections")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "obligation_collections")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => obligationsUseCases.loadObligationCollections({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list collections" },
        };
      }
    },
    listTypes: async ({
      request,
    }: ContractRouteArgs<(typeof obligationContract)["listTypes"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["listTypes"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "obligation_types")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => obligationsUseCases.loadObligationTypes(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list obligation types" },
        };
      }
    },
    listMujtahids: async ({
      request,
    }: ContractRouteArgs<(typeof obligationContract)["listMujtahids"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["listMujtahids"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "mujtahids")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => obligationsUseCases.loadMujtahids(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list mujtahids" },
        };
      }
    },
    listDistributions: async ({
      request,
    }: ContractRouteArgs<(typeof obligationContract)["listDistributions"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["listDistributions"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "obligation_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => obligationsUseCases.loadObligationDistributions(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list distributions" },
        };
      }
    },
    getPreferences: async ({
      request,
    }: ContractRouteArgs<(typeof obligationContract)["getPreferences"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["getPreferences"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "obligation_collections")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const raw = await getObligationPreferencesService();
        const preferences = normalizeObligationsModulePreferences(raw);
        return { status: 200 as const, body: { preferences } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load preferences" },
        };
      }
    },
    updatePreferences: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof obligationContract)["updatePreferences"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["updatePreferences"]>
    > => {
      const user = request.user as User;
      if (!roleHasPermission(user.role, OBLIGATIONS_MODULE_MANIFEST.permissions.setupWrite)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const normalized = normalizeObligationsModulePreferences(body);
        const saved = await updateObligationPreferencesService(normalized);
        await auditObligations(
          user,
          "UPDATE_OBLIGATIONS_PREFERENCES",
          "Updated obligations module preferences",
          "preferences",
        );
        return { status: 200 as const, body: { success: true, preferences: saved } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to update preferences" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof obligationContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
