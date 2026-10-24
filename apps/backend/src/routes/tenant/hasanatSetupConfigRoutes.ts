import type { FastifyPluginAsync } from "fastify";
import {
  HASANAT_MODULE_MANIFEST,
  hasanatFieldConfigPutBodySchema,
  hasanatPreferencesPutBodySchema,
  normalizeHasanatModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../services/rbacService.js";
import {
  getHasanatFieldConfigService,
  updateHasanatFieldConfigService,
} from "../../services/hasanatConfigService.js";
import {
  getHasanatPreferencesService,
  updateHasanatPreferencesService,
} from "../../services/hasanatPreferencesService.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";

const auditHasanat = createCollectionAuditHelper("hasanat_distributions");

/** Hasanat Setup field-config + preferences (typed FORCE-RLS tables). */
export const hasanatSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "hasanat_distributions"),
    setupWritePermission: HASANAT_MODULE_MANIFEST.permissions.setupWrite,

    fieldConfigSchema: hasanatFieldConfigPutBodySchema,
    loadFieldConfig: getHasanatFieldConfigService,
    saveFieldConfig: (body) => updateHasanatFieldConfigService(body),

    preferencesSchema: hasanatPreferencesPutBodySchema,
    loadPreferences: getHasanatPreferencesService,
    normalizePreferences: normalizeHasanatModulePreferences,
    savePreferences: (normalized) => updateHasanatPreferencesService(normalized),

    audit: auditHasanat,
    fieldConfigAuditAction: "UPDATE_HASANAT_CONFIG",
    fieldConfigAuditSummary: "Updated hasanat field configuration",
    preferencesAuditAction: "UPDATE_HASANAT_PREFERENCES",
    preferencesAuditSummary: "Updated hasanat module preferences",
    loadFieldConfigError: "Failed to load hasanat field config",
    saveFieldConfigError: "Failed to save hasanat field config",
    loadPreferencesError: "Failed to load hasanat preferences",
    savePreferencesError: "Failed to save hasanat preferences",
  });
};
