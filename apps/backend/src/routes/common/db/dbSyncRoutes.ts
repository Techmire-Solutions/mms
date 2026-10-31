import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { resetToDefaults } from "../../../services/dbSyncService.js";
import { restoreWorkspaceWithAudit } from "../../../services/dbSyncRestoreAudit.js";
import {
  canBulkSync,
  canDownloadBulkSync,
  canResetTenantData,
} from "../../../services/rbacService.js";
import { type TenantDatabaseSnapshot, validateAndNormalizeSnapshot } from "@mms/shared";
import type { User } from "@mms/shared";
import {
  SYNC_ABORTED_MESSAGE,
  SYNC_MAX_BODY_BYTES,
  withSyncTimeout,
} from "../../../lib/syncLimits.js";
import { tenantDatabaseSnapshotSchema as syncPayloadSchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendBadRequest, sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import {
  stripServerOnlyObjects,
  stripUnwritableCollections,
  stripUnwritableObjects,
} from "./dbRouteHelpers.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import {
  beginLongLivedTenantTransaction,
  clearActiveTransaction,
  enterActiveTransaction,
  type LongLivedTenantTransaction,
} from "../../../db/dbConnection.js";
import { streamSyncSnapshot, streamBackupSnapshot } from "../../../db/streamingSnapshotProducer.js";
import { createStreamAdmissionControl } from "../../../lib/streamAdmissionControl.js";

/**
 * Admission control for snapshot/backup streams — see
 * `lib/streamAdmissionControl.ts` for the rationale and the 503 contract.
 */
const snapshotAdmission = createStreamAdmissionControl({
  limit: 3,
  retryAfterSeconds: 30,
  unavailableMessage: "Too many snapshot downloads are in progress. Please retry shortly.",
});

/**
 * Drives a streaming snapshot generator against a long-lived tenant transaction,
 * committing on clean completion and rolling back+releasing on error or early
 * client disconnect, so the pooled client is always returned.
 */
async function* streamSnapshotRoute(
  txn: LongLivedTenantTransaction,
  tenant: string | null,
  stream: (txn: LongLivedTenantTransaction, tenant: string | null) => AsyncGenerator<string>,
  releaseSlot?: () => void,
): AsyncGenerator<string> {
  let completed = false;
  try {
    yield* stream(txn, tenant);
    completed = true;
  } finally {
    clearActiveTransaction();
    if (completed) {
      await txn.commit().catch(() => undefined);
    } else {
      await txn.rollback().catch(() => undefined);
    }
    // Runs on clean completion AND on early close (client disconnect), so the
    // stream budget can never leak.
    releaseSlot?.();
  }
}

/** Bulk sync download/upload and workspace reset routes. */
export const dbSyncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/sync", async (request, reply) => {
    const user = request.user as User;
    if (!canDownloadBulkSync(user)) {
      return sendForbidden(reply, "Only administrators can download a database snapshot");
    }
    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply, "This endpoint requires a tenant subdomain");
    const releaseSlot = snapshotAdmission.acquire(reply);
    if (!releaseSlot) return;
    let txn: LongLivedTenantTransaction | null = null;
    try {
      txn = await beginLongLivedTenantTransaction(tenant, {
        isolation: "repeatable read",
        statementTimeoutMs: 600_000,
        idleTimeoutMs: 600_000,
      });
      enterActiveTransaction(txn.tx);
      reply.header("Content-Type", "application/json; charset=utf-8");
      return reply.send(
        Readable.from(streamSnapshotRoute(txn, tenant, streamSyncSnapshot, releaseSlot)),
      );
    } catch (error: unknown) {
      releaseSlot();
      clearActiveTransaction();
      if (txn) await txn.rollback().catch(() => undefined);
      return sendDatabaseError(reply, "Failed to retrieve database snapshot", error);
    }
  });

  fastify.get("/backup", async (request, reply) => {
    const user = request.user as User;
    if (!canDownloadBulkSync(user)) {
      return sendForbidden(reply, "Only administrators can download a workspace backup");
    }
    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply, "This endpoint requires a tenant subdomain");
    const releaseSlot = snapshotAdmission.acquire(reply);
    if (!releaseSlot) return;
    let txn: LongLivedTenantTransaction | null = null;
    try {
      txn = await beginLongLivedTenantTransaction(tenant, {
        isolation: "repeatable read",
        statementTimeoutMs: 600_000,
        idleTimeoutMs: 600_000,
      });
      enterActiveTransaction(txn.tx);
      reply.header("Content-Type", "application/json; charset=utf-8");
      return reply.send(
        Readable.from(streamSnapshotRoute(txn, tenant, streamBackupSnapshot, releaseSlot)),
      );
    } catch (error: unknown) {
      releaseSlot();
      clearActiveTransaction();
      if (txn) await txn.rollback().catch(() => undefined);
      return sendDatabaseError(reply, "Failed to build workspace backup snapshot", error);
    }
  });

  fastify.post("/sync", { bodyLimit: SYNC_MAX_BODY_BYTES }, async (request, reply) => {
    const user = request.user as User;
    if (!canBulkSync(user)) {
      return sendForbidden(reply, "Only administrators can perform bulk database sync");
    }
    const parsed = parseRequest(syncPayloadSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    try {
      const snapshot = parsed.data as TenantDatabaseSnapshot;
      const validatedSnapshot = validateAndNormalizeSnapshot(snapshot);
      if (!validatedSnapshot.ok) {
        if (validatedSnapshot.errorKey === "backup.missingAdminUser") {
          return sendForbidden(reply, "Sync payload must contain at least one administrator");
        }
        return sendForbidden(reply, "Sync payload contains restricted keys or prototype pollution");
      }

      const payload = validatedSnapshot.data;
      if (payload.collections) {
        stripUnwritableCollections(payload.collections, user);
      }
      if (payload.objects) {
        stripServerOnlyObjects(payload.objects);
        stripUnwritableObjects(payload.objects, user);
      }
      const tenant = getRequestTenant();
      if (!tenant) {
        return sendForbidden(reply, "Tenant context is required for a workspace restore");
      }
      await withSyncTimeout((signal) =>
        restoreWorkspaceWithAudit({ tenant, payload, signal, actorUserId: String(user.id) }),
      );
      return reply.send({ success: true });
    } catch (error: unknown) {
      const err = error as Error & { statusCode?: number; type?: string };
      if (err.statusCode === 408) {
        return reply.status(408).send({
          type: "server_error",
          message: SYNC_ABORTED_MESSAGE,
        });
      }
      if (typeof err.message === "string" && err.message.startsWith("backup.")) {
        return reply.status(err.statusCode ?? 400).send({
          type: err.type ?? "validation_error",
          message: err.message,
        });
      }
      return sendDatabaseError(reply, "Failed to synchronize database snapshot", error);
    }
  });

  fastify.post("/reset", async (request, reply) => {
    const user = request.user as User;
    if (!canResetTenantData(user)) {
      return sendForbidden(reply, "Only administrators can reset the database");
    }
    const body = (request.body ?? {}) as { confirm?: unknown };
    if (body.confirm !== "RESET") {
      return sendBadRequest(
        reply,
        'Send { "confirm": "RESET" } to acknowledge that this wipes the workspace',
      );
    }
    try {
      // Purge + reseed + audit commit together; a failure rolls the workspace back.
      await resetToDefaults();
      return reply.send({ success: true, message: "Workspace reset to minimal defaults" });
    } catch (error: unknown) {
      return sendDatabaseError(reply, "Failed to reset database", error);
    }
  });
};
