import type { FastifyPluginAsync } from "fastify";
import {
  isQueryFlagTrue,
  type User,
  obligationContract,
  OBLIGATIONS_MODULE_MANIFEST,
  normalizeObligationsModulePreferences,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  installContractErrorHandler,
  standardRequestValidationErrorHandler,
} from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canDeleteCollection } from "../../../services/rbacService.js";
import { obligationsUseCases } from "../../../obligations/use-cases/obligationsUseCases.js";
import {
  getObligationPreferencesService,
  updateObligationPreferencesService,
} from "../../../services/obligationPreferencesService.js";
import { mapDomainError } from "../../../lib/httpErrors.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

const s = initServer();

/**
 * Maps a use-case failure to its declared ts-rest response.
 *
 * These handlers used to flatten every failure into `500 database_error`, so a domain rejection
 * (`ValidationError`, `ConflictError`) reached the client as a server fault and was not even
 * logged. Domain errors now keep their status and `type`; anything unmapped stays a 500 with the
 * message the caller expects.
 */
function obligationsError(
  error: unknown,
  fallbackMessage: string,
): { status: number; body: { type: string; message: string } } {
  const mapped = mapDomainError(error);
  if (mapped) return { status: mapped.status, body: mapped.body };
  return { status: 500, body: { type: "database_error", message: fallbackMessage } };
}

export const obligationContractRouter: FastifyPluginAsync = async (fastify) => {
  // The ts-rest adapter installs its own error handler; without this wrapper an escaped domain
  // error or a response that drifted from its declared schema would not be mapped or logged.
  installContractErrorHandler(fastify);

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
        const result = await obligationsUseCases.runObligationsRead(() =>
          obligationsUseCases.loadObligationCollections({ ...query, includeDeleted }),
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: listCollections failed");
        return obligationsError(error, "Failed to list collections");
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
        const result = await obligationsUseCases.runObligationsRead(() =>
          obligationsUseCases.loadObligationTypes(),
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to list obligation types");
        return obligationsError(error, "Failed to list obligation types");
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
        const result = await obligationsUseCases.runObligationsRead(() =>
          obligationsUseCases.loadMujtahids(),
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to list mujtahids");
        return obligationsError(error, "Failed to list mujtahids");
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
        const result = await obligationsUseCases.runObligationsRead(() =>
          obligationsUseCases.loadObligationDistributions(),
        );
        return { status: 200 as const, body: result };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to list distributions");
        return obligationsError(error, "Failed to list distributions");
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
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to load preferences");
        return obligationsError(error, "Failed to load preferences");
      }
    },
    updatePreferences: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof obligationContract)["updatePreferences"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["updatePreferences"]>
    > => {
      const user = request.user as User;
      if (!userHasPermission(user, OBLIGATIONS_MODULE_MANIFEST.permissions.setupWrite)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const normalized = normalizeObligationsModulePreferences(body);
        // The service owns the save *and* its audit row; the controller no longer writes one.
        const saved = await updateObligationPreferencesService(normalized, user);
        return { status: 200 as const, body: { success: true, preferences: saved } };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to update preferences");
        return obligationsError(error, "Failed to update preferences");
      }
    },
    getCollectionVoucher: async ({
      params,
      request,
    }: ContractRouteArgs<(typeof obligationContract)["getCollectionVoucher"]>): Promise<
      ContractRouteResponse<(typeof obligationContract)["getCollectionVoucher"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "obligation_collections")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await obligationsUseCases.loadObligationCollectionVoucher(params.id);
        if (!result) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Accounting voucher not found" },
          };
        }
        return {
          status: 200 as const,
          body: {
            entry: result.entry as unknown as Record<string, unknown>,
            accounts: result.accounts as unknown as Record<string, unknown>[],
          },
        };
      } catch (error: unknown) {
        request.log.warn({ err: error }, "obligations: Failed to load obligation voucher");
        return obligationsError(error, "Failed to load obligation voucher");
      }
    },
  } as unknown as RouterImplementation<typeof obligationContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
    // A handler body that no longer matches its declared schema must fail loudly here rather than
    // ship a payload the client cannot rely on. Matches accounting/workshops/sessions/questionBank.
    responseValidation: true,
  });
};
