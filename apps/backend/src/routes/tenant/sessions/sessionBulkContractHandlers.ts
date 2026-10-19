import { type sessionContract, SESSIONS_MODULE_MANIFEST, type User } from "@mms/shared";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

export const sessionBulkContractHandlers = {
  bulkDelete: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["bulkDelete"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["bulkDelete"]>
  > => {
    const user = request.user as User;
    if (!canDeleteCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () =>
          sessionsUseCases.bulkSoftDeleteSessions(
            body.ids.map(String),
            String(user.id),
            body.deletionReason,
          ),
        { readOnly: false },
      );
      return { status: 200 as const, body: { success: true, ...result } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to bulk delete sessions" },
      });
    }
  },

  bulkStatus: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["bulkStatus"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["bulkStatus"]>
  > => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => sessionsUseCases.bulkUpdateSessionsStatus(body.ids.map(String), body.status),
        { readOnly: false },
      );
      return { status: 200 as const, body: { success: true, ...result } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to bulk update session status" },
      });
    }
  },

  bulkRestore: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["bulkRestore"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["bulkRestore"]>
  > => {
    const user = request.user as User;
    if (!canDeleteCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => sessionsUseCases.bulkRestoreSessions(body.ids.map(String), String(user.id)),
        { readOnly: false },
      );
      return { status: 200 as const, body: { success: true, ...result } };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to bulk restore sessions" },
      });
    }
  },
};
