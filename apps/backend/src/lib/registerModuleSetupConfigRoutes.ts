import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, z } from "zod";
import type { Permission, User } from "@mms/shared";
import { roleHasPermission } from "@mms/shared";
import { sendDatabaseError, sendForbidden } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { getRequestTenant } from "./tenantContext.js";
import { getOrSetMultiTier, invalidateMultiTierCache } from "./cache/index.js";

export type RegisterModuleSetupConfigRoutesOptions<
  TConfigSchema extends ZodType = ZodType,
  TPrefsSchema extends ZodType = ZodType,
  TConfig = z.infer<TConfigSchema>,
  TPrefs = z.infer<TPrefsSchema>,
  TPrefsInput = never,
> = {
  domain?: string;
  canRead: (user: User) => boolean;
  setupWritePermission: Permission;
  fieldConfigSchema: TConfigSchema;
  preferencesSchema: TPrefsSchema;
  loadFieldConfig: () => Promise<TConfig | null | unknown>;
  saveFieldConfig: (body: TConfig) => Promise<unknown>;
  loadPreferences: () => Promise<TPrefs | null | unknown>;
  /** Normalize prefs for GET fallback and before save. */
  normalizePreferences: (partial?: TPrefsInput) => TPrefs;
  savePreferences: (normalized: TPrefs) => Promise<unknown>;
  audit: (user: User, action: string, summary: string, entityId: string) => Promise<void>;
  fieldConfigAuditAction: string;
  fieldConfigAuditSummary: string;
  preferencesAuditAction: string;
  preferencesAuditSummary: string;
  loadFieldConfigError?: string;
  saveFieldConfigError?: string;
  loadPreferencesError?: string;
  savePreferencesError?: string;
};

/**
 * Register GET/PUT `/field-config` + `/preferences` for module Setup with multi-tier L1/L2 caching.
 */
export function registerModuleSetupConfigRoutes<
  TConfigSchema extends ZodType = ZodType,
  TPrefsSchema extends ZodType = ZodType,
  TConfig = z.infer<TConfigSchema>,
  TPrefs = z.infer<TPrefsSchema>,
  TPrefsInput = never,
>(
  fastify: FastifyInstance,
  options: RegisterModuleSetupConfigRoutesOptions<
    TConfigSchema,
    TPrefsSchema,
    TConfig,
    TPrefs,
    TPrefsInput
  >,
): void {
  const canWriteSetup = (user: User) => roleHasPermission(user.role, options.setupWritePermission);

  const domain = options.domain ?? options.fieldConfigAuditAction.split(".")[0] ?? "setup";

  const handleGetFieldConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as User;
    if (!options.canRead(user)) return sendForbidden(reply);
    const tenant = getRequestTenant() ?? user.workspaceSubdomain;
    try {
      if (tenant) {
        const config = await getOrSetMultiTier(
          tenant,
          `setup:${domain}`,
          "field-config",
          async () => options.loadFieldConfig(),
          { ttlSeconds: 600 },
        );
        return reply.send({ config });
      }
      const config = await options.loadFieldConfig();
      return reply.send({ config });
    } catch (error: unknown) {
      return sendDatabaseError(
        reply,
        options.loadFieldConfigError ?? "Failed to load field config",
        error,
      );
    }
  };
  fastify.get("/field-config", handleGetFieldConfig);
  fastify.get("/config/fields", handleGetFieldConfig);

  const handlePutFieldConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return sendForbidden(reply);
    const body = parseRequest(options.fieldConfigSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const tenant = getRequestTenant() ?? user.workspaceSubdomain;
    try {
      const saved = await options.saveFieldConfig(body.data as TConfig);
      if (tenant) {
        await invalidateMultiTierCache({
          tenantId: tenant,
          domain: `setup:${domain}`,
          key: "field-config",
        });
      }
      try {
        await options.audit(
          user,
          options.fieldConfigAuditAction,
          options.fieldConfigAuditSummary,
          "field-config",
        );
      } catch (auditError) {
        fastify.log.warn({ err: auditError }, "Failed to record field config audit log");
      }
      return reply.send({ success: true, config: saved });
    } catch (error: unknown) {
      return sendDatabaseError(
        reply,
        options.saveFieldConfigError ?? "Failed to save field config",
        error,
      );
    }
  };
  fastify.put("/field-config", handlePutFieldConfig);
  fastify.put("/config/fields", handlePutFieldConfig);

  const handleGetPreferences = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as User;
    if (!options.canRead(user)) return sendForbidden(reply);
    const tenant = getRequestTenant() ?? user.workspaceSubdomain;
    try {
      if (tenant) {
        const preferences = await getOrSetMultiTier(
          tenant,
          `setup:${domain}`,
          "preferences",
          async () => {
            const loaded = await options.loadPreferences();
            return loaded ?? options.normalizePreferences();
          },
          { ttlSeconds: 600 },
        );
        return reply.send({
          preferences: preferences ?? options.normalizePreferences(),
        });
      }
      const preferences = await options.loadPreferences();
      return reply.send({
        preferences: preferences ?? options.normalizePreferences(),
      });
    } catch (error: unknown) {
      return sendDatabaseError(
        reply,
        options.loadPreferencesError ?? "Failed to load preferences",
        error,
      );
    }
  };
  fastify.get("/preferences", handleGetPreferences);
  fastify.get("/config/preferences", handleGetPreferences);

  const handlePutPreferences = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as User;
    if (!canWriteSetup(user)) return sendForbidden(reply);
    const body = parseRequest(options.preferencesSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const tenant = getRequestTenant() ?? user.workspaceSubdomain;
    try {
      const saved = await options.savePreferences(
        options.normalizePreferences(body.data as TPrefsInput),
      );
      if (tenant) {
        await invalidateMultiTierCache({
          tenantId: tenant,
          domain: `setup:${domain}`,
          key: "preferences",
        });
      }
      try {
        await options.audit(
          user,
          options.preferencesAuditAction,
          options.preferencesAuditSummary,
          "preferences",
        );
      } catch (auditError) {
        fastify.log.warn({ err: auditError }, "Failed to record preferences audit log");
      }
      return reply.send({ success: true, preferences: saved });
    } catch (error: unknown) {
      return sendDatabaseError(
        reply,
        options.savePreferencesError ?? "Failed to save preferences",
        error,
      );
    }
  };
  fastify.put("/preferences", handlePutPreferences);
  fastify.put("/config/preferences", handlePutPreferences);
}
