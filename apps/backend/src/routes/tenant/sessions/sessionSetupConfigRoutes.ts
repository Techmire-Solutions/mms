import type { FastifyPluginAsync } from "fastify";
import {
  SESSIONS_MODULE_MANIFEST,
  sessionFieldConfigPutBodySchema,
  sessionPreferencesPutBodySchema,
  normalizeSessionModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  loadSessionFieldConfig,
  saveSessionFieldConfig,
} from "../../../services/sessionConfigService.js";
import {
  loadSessionModulePreferences,
  saveSessionModulePreferences,
} from "../../../services/sessionPreferencesService.js";
import { auditSession } from "./sessionRouteHelpers.js";

/** Sessions Setup field-config + preferences (typed FORCE-RLS tables). */
export const sessionSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "sessions"),
    setupWritePermission: SESSIONS_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: sessionFieldConfigPutBodySchema,
    preferencesSchema: sessionPreferencesPutBodySchema,
    loadFieldConfig: loadSessionFieldConfig,
    saveFieldConfig: (body) => saveSessionFieldConfig(body),
    loadPreferences: loadSessionModulePreferences,
    normalizePreferences: normalizeSessionModulePreferences,
    savePreferences: saveSessionModulePreferences,
    audit: auditSession,
    fieldConfigAuditAction: "session.field-config",
    fieldConfigAuditSummary: "Updated session field configuration",
    preferencesAuditAction: "session.preferences",
    preferencesAuditSummary: "Updated session module preferences",
    loadFieldConfigError: "Failed to load session field config",
    saveFieldConfigError: "Failed to save session field config",
    loadPreferencesError: "Failed to load session preferences",
    savePreferencesError: "Failed to save session preferences",
  });
};
