import type { FastifyPluginAsync } from "fastify";
import { fetchObject, persistObject } from "../../../services/dbSyncService.js";
import { canReadObject, canWriteObject } from "../../../services/rbacService.js";
import {
  isServerOnlyObjectKey,
  mergeBrandingSettings,
  mergeGlobalSettings,
  type BrandingSettings,
  type GlobalSettings,
} from "@mms/shared";
import type { User } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  getWorkspaceBranding,
  syncWorkspaceFromBranding,
  upsertWorkspaceBranding,
} from "../../../services/workspaceService.js";
import {
  loadGlobalSettings,
  saveGlobalSettings,
  maskGlobalSettingsForClient,
  redactAdminOnlyGlobalSettings,
  sanitizeGlobalSettingsWrite,
} from "../../../services/globalSettingsService.js";
import { sanitizeBrandingWrite } from "../../../services/workspacePresentationService.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";
import { resourceKeyParamsSchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";

/** Object keys that always generate an audit event on write. */
const AUDITED_OBJECTS = new Set(["global_settings", "branding"]);

/**
 * `global_settings`/`branding` are readable and partially writable by any authenticated
 * tenant user — Language & Region, Theme mode, and branding theme fields are open to
 * everyone; the rest is field-filtered by `canWriteObject` inside each handler instead
 * of gating the whole key behind `OBJECT_READ_PERMISSION`/`OBJECT_WRITE_PERMISSION`.
 */
const SELF_MANAGED_OBJECT_KEYS = new Set(["global_settings", "branding"]);

/** Document-store KV object read/write routes. */
export const dbObjectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/objects/:key", async (request, reply) => {
    const params = parseRequest(resourceKeyParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const { key } = params.data;
    const user = request.user as User;
    try {
      if (isServerOnlyObjectKey(key)) {
        return reply.status(404).send({
          type: "not_found",
          message: `Object with key "${key}" not found`,
        });
      }
      if (!SELF_MANAGED_OBJECT_KEYS.has(key) && !canReadObject(user, key)) {
        return sendForbidden(reply, `You do not have permission to read object "${key}"`);
      }
      if (key === "branding") {
        const tenant = getRequestTenant()!;
        // Institution identity fields aren't secret (already public via
        // /api/workspace/by-subdomain) so the full object is safe to read for
        // any authenticated tenant user — only writing identity fields is gated.
        const branding = await getWorkspaceBranding(tenant);
        if (branding) return reply.send(branding);
      } else if (key === "global_settings") {
        const tenant = getRequestTenant()!;
        const globalSettings = await loadGlobalSettings(tenant);
        if (globalSettings) {
          const canWriteGlobal = canWriteObject(user, "global_settings");
          const visible = canWriteGlobal
            ? globalSettings
            : redactAdminOnlyGlobalSettings(globalSettings);
          // Never return full LLM secrets to the client — only masked hints.
          return reply.send(maskGlobalSettingsForClient(visible));
        }
      }

      const objectValue = await fetchObject(key);
      if (objectValue === null) {
        return reply.status(404).send({
          type: "not_found",
          message: `Object with key "${key}" not found`,
        });
      }
      return reply.send(objectValue);
    } catch (error: unknown) {
      return sendDatabaseError(reply, `Failed to retrieve object "${key}"`, error);
    }
  });

  fastify.post("/objects/:key", async (request, reply) => {
    const params = parseRequest(resourceKeyParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const { key } = params.data;
    const user = request.user as User;
    if (isServerOnlyObjectKey(key)) {
      return sendForbidden(reply, `Object key "${key}" cannot be modified through this endpoint`);
    }
    if (!SELF_MANAGED_OBJECT_KEYS.has(key) && !canWriteObject(user, key)) {
      return sendForbidden(reply, `You do not have permission to write object "${key}"`);
    }
    try {
      const raw = request.body;
      // The KV object store persists arbitrary JSON documents. Reject
      // non-object payloads (null, arrays, primitives) so a malformed write
      // cannot corrupt a stored document.
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return reply.status(400).send({
          type: "validation_error",
          message: "Object body must be a JSON object",
        });
      }
      let objectValueToSave =
        key === "branding"
          ? mergeBrandingSettings(raw as Partial<BrandingSettings>)
          : key === "global_settings"
            ? mergeGlobalSettings(raw as Partial<GlobalSettings>)
            : raw;

      const tenant = getRequestTenant();
      if (key === "branding" && tenant && !canWriteObject(user, "branding")) {
        const current = (await getWorkspaceBranding(tenant)) ?? mergeBrandingSettings(null);
        objectValueToSave = sanitizeBrandingWrite(objectValueToSave as BrandingSettings, current);
      } else if (key === "global_settings" && tenant && !canWriteObject(user, "global_settings")) {
        const current = await loadGlobalSettings(tenant);
        objectValueToSave = sanitizeGlobalSettingsWrite(
          objectValueToSave as GlobalSettings,
          current,
        );
      }

      // The document write and its audit event share ONE tenant transaction.
      // Previously the audit append was fire-and-forget (`.catch()` after the
      // write had already committed), which on a FORCE RLS table meant a failed
      // append left no row in the chain and only a log line behind.
      if (tenant) {
        await withTenant(tenant, async (tx) => {
          await persistObject(key, objectValueToSave);

          if (AUDITED_OBJECTS.has(key)) {
            await recordModernAuditEvent(tx, {
              workspaceSubdomain: tenant,
              tableName: key,
              recordId: key,
              actionType: "UPDATE",
              realUserId: String(user.id),
            });
          }

          if (key === "branding") {
            await syncWorkspaceFromBranding(tenant, objectValueToSave as BrandingSettings);
            await upsertWorkspaceBranding(tenant, objectValueToSave as BrandingSettings);
          } else if (key === "global_settings") {
            await saveGlobalSettings(objectValueToSave as GlobalSettings, tenant);
          }
        });
      } else {
        // Platform/apex writes (onboarding branding) have no tenant scope.
        await persistObject(key, objectValueToSave);
      }

      return reply.send({ success: true });
    } catch (error: unknown) {
      return sendDatabaseError(reply, `Failed to save object "${key}"`, error);
    }
  });
};
