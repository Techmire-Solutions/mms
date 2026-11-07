import { type sessionContract, SESSIONS_MODULE_MANIFEST, type User } from "@mms/shared";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId } from "../../../lib/backgroundJobIds.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

async function queueBulkJob(
  request: ContractRouteArgs<(typeof sessionContract)["bulkStatus"]>["request"],
  kind: "bulk-status" | "bulk-archive",
  label: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ status: 202; body: { job: Record<string, unknown> } }> {
  const user = request.user as User;
  const tenant = String(request.tenant?.id ?? "");
  const userId = String(user.id);
  // A client retry with the same key maps to the same job id; a completed job is returned as-is.
  const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);
  const existing = await getUserBackgroundJob(userId, jobId);
  if (existing) return { status: 202 as const, body: { job: existing as never } };
  try {
    const job = await enqueueBackgroundJob(
      tenant,
      userId,
      {
        id: jobId,
        moduleId: "sessions",
        kind,
        status: "running",
        label,
        createdAt: new Date().toISOString(),
      },
      payload,
    );
    return { status: 202 as const, body: { job: job as never } };
  } catch (error) {
    if (error instanceof QueueUnavailableError) throw error;
    throw error;
  }
}

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
    // Lifecycle shifts (cancel/complete/archive) are Academic Admin authority, not ordinary edit.
    if (!userHasPermission(user, SESSIONS_MODULE_MANIFEST.permissions.manage))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    // Cancelling is destructive (ends enrollments, voids invoices): it must carry a reason on every
    // path, including the bulk one.
    if (body.status === "cancelled" && (body.reason ?? "").trim().length < 3)
      return {
        status: 400 as const,
        body: {
          type: "validation_error",
          message: "A cancellation reason (at least 3 characters) is required",
        },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () =>
          sessionsUseCases.bulkUpdateSessionsStatus(body.ids.map(String), body.status, body.reason),
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

  bulkStatusJob: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["bulkStatusJob"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["bulkStatusJob"]>
  > => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    if (!userHasPermission(user, SESSIONS_MODULE_MANIFEST.permissions.manage))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      return await queueBulkJob(
        request,
        "bulk-status",
        `Bulk session status: ${body.status} (${body.ids.length})`,
        { ids: body.ids.map(String), status: body.status, reason: body.reason ?? null },
        body.idempotencyKey,
      );
    } catch (error) {
      if (error instanceof QueueUnavailableError)
        return {
          status: 409 as const,
          body: { type: "queue_unavailable", message: error.message },
        };
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to queue the bulk status job" },
      });
    }
  },

  bulkArchiveJob: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof sessionContract)["bulkArchiveJob"]>): Promise<
    ContractRouteResponse<(typeof sessionContract)["bulkArchiveJob"]>
  > => {
    const user = request.user as User;
    if (!canDeleteCollection(user, COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      return await queueBulkJob(
        request,
        "bulk-archive",
        `Bulk archive sessions (${body.ids.length})`,
        { ids: body.ids.map(String), deletionReason: body.deletionReason ?? null },
        body.idempotencyKey,
      );
    } catch (error) {
      if (error instanceof QueueUnavailableError)
        return {
          status: 409 as const,
          body: { type: "queue_unavailable", message: error.message },
        };
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to queue the bulk archive job" },
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
