import type { FastifyPluginAsync } from "fastify";
import { fetchCollection, persistCollection } from "../../../services/dbSyncService.js";
import {
  canReadCollection,
  canWriteCollection,
  isAllowedCollectionName,
} from "../../../services/rbacService.js";
import { WORKSPACES_COLLECTION } from "@mms/shared";
import type { User } from "@mms/shared";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { withTenant } from "../../../db/tenant-context.js";

/** Collection names that always generate an audit event on write. */
const AUDITED_COLLECTIONS = new Set(["users", "contacts"]);

import { SYNC_MAX_BODY_BYTES } from "../../../lib/syncLimits.js";
import { collectionSaveBodySchema, resourceNameParamsSchema } from "@mms/shared";
import type { z } from "zod";

/** Normalize a collection save body — arrays pass through, `{ data }` objects unwrap. */
function normalizeCollectionSaveBody(body: z.infer<typeof collectionSaveBodySchema>): unknown[] {
  if (Array.isArray(body)) return body;
  return body.data;
}
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendDatabaseError, sendForbidden, sendNotFound } from "../../../lib/httpErrors.js";

/** Document-store collection read/write routes. */
export const dbCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/collections/:name", async (request, reply) => {
    const params = parseRequest(resourceNameParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const { name } = params.data;
    if (name === WORKSPACES_COLLECTION) {
      return sendForbidden(reply, `You do not have permission to read collection "${name}"`);
    }
    if (!isAllowedCollectionName(name)) {
      return sendNotFound(reply, `Collection "${name}" is not available via document store`);
    }
    const user = request.user as User;
    if (!canReadCollection(user, name)) {
      return sendForbidden(reply, `You do not have permission to read collection "${name}"`);
    }
    try {
      const collectionRows = await fetchCollection(name);
      if (collectionRows === null) {
        return reply.send([]);
      }
      return reply.send(collectionRows);
    } catch (error: unknown) {
      return sendDatabaseError(reply, `Failed to retrieve collection "${name}"`, error);
    }
  });

  fastify.post("/collections/:name", { bodyLimit: SYNC_MAX_BODY_BYTES }, async (request, reply) => {
    const params = parseRequest(resourceNameParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const { name } = params.data;
    if (name === WORKSPACES_COLLECTION) {
      return sendForbidden(reply, `You do not have permission to write collection "${name}"`);
    }
    if (!isAllowedCollectionName(name)) {
      return sendNotFound(reply, `Collection "${name}" is not available via document store`);
    }
    const user = request.user as User;
    if (!canWriteCollection(user, name)) {
      return sendForbidden(reply, `You do not have permission to write collection "${name}"`);
    }
    try {
      const bodyParsed = parseRequest(collectionSaveBodySchema, request.body);
      if (!bodyParsed.ok) return replyValidationError(reply, bodyParsed.message);
      const collectionRowsToSave = normalizeCollectionSaveBody(bodyParsed.data);

      const tenant = getRequestTenant();
      const write = async (tx?: unknown) => {
        await persistCollection(name, collectionRowsToSave);
        if (AUDITED_COLLECTIONS.has(name)) {
          // Awaited inside the caller's transaction: a swallowed failure used to
          // leave no row in the audit chain and only a log line behind.
          const input = {
            workspaceSubdomain: tenant ?? "unknown",
            tableName: name,
            recordId: name,
            actionType: "UPDATE" as const,
            realUserId: String(user.id),
            newState: { summary: `Wrote ${collectionRowsToSave.length} row(s)` },
          };
          if (tx) await recordModernAuditEvent(tx as never, input);
          else await recordModernAuditEvent(input);
        }
      };

      // Platform/apex writes have no tenant scope; tenant writes share one
      // transaction with their audit append.
      if (tenant) await withTenant(tenant, async (tx) => write(tx));
      else await write();

      return reply.send({ success: true });
    } catch (error: unknown) {
      return sendDatabaseError(reply, `Failed to save collection "${name}"`, error);
    }
  });
};
