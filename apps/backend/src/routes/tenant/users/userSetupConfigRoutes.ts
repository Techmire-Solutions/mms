import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  USERS_MODULE_MANIFEST,
  userFieldConfigPutBodySchema,
  userPreferencesPutBodySchema,
  normalizeUserModulePreferences,
  composeUsersSettings,
  type User,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { loadUserFieldConfig, saveUserFieldConfig } from "../../../services/userConfigService.js";
import {
  loadUserModulePreferences,
  saveUserModulePreferences,
} from "../../../services/userPreferencesService.js";
import { auditUser } from "./userRouteHelpers.js";

/** Users Setup field-config + preferences (typed FORCE-RLS tables). */
export const userSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "users"),
    setupWritePermission: USERS_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: userFieldConfigPutBodySchema,
    preferencesSchema: userPreferencesPutBodySchema,
    loadFieldConfig: loadUserFieldConfig,
    saveFieldConfig: (body) => saveUserFieldConfig(body),
    loadPreferences: loadUserModulePreferences,
    normalizePreferences: normalizeUserModulePreferences,
    savePreferences: saveUserModulePreferences,
    audit: auditUser,
    fieldConfigAuditAction: "user.field-config",
    fieldConfigAuditSummary: "Updated user field configuration",
    preferencesAuditAction: "user.preferences",
    preferencesAuditSummary: "Updated user module preferences",
    loadFieldConfigError: "Failed to load user field config",
    saveFieldConfigError: "Failed to save user field config",
    loadPreferencesError: "Failed to load user preferences",
    savePreferencesError: "Failed to save user preferences",
  });

  const handleGetComposed = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as User;
    if (!canReadCollection(user, "users")) return sendForbidden(reply);
    try {
      const [fieldConfig, preferences] = await Promise.all([
        loadUserFieldConfig(),
        loadUserModulePreferences(),
      ]);
      const composed = composeUsersSettings(fieldConfig, preferences);
      return reply.send(composed);
    } catch (error: unknown) {
      return sendDatabaseError(reply, "Failed to load composed user configuration", error);
    }
  };

  fastify.get("/config/composed", handleGetComposed);
  fastify.get("/composed", handleGetComposed);
};
