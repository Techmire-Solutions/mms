import type { FastifyPluginAsync } from "fastify";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examinationsFieldConfigPutBodySchema,
  examinationsPreferencesPutBodySchema,
  normalizeExaminationsModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../services/rbacService.js";
import {
  getExaminationFieldConfigService,
  updateExaminationFieldConfigService,
} from "../../services/examinationConfigService.js";
import {
  getExaminationPreferencesService,
  updateExaminationPreferencesService,
} from "../../services/examinationPreferencesService.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";

const auditExaminations = createCollectionAuditHelper("exams");

/** Examinations Setup field-config + preferences (typed FORCE-RLS tables). */
export const examinationSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "exams"),
    setupWritePermission: EXAMINATIONS_MODULE_MANIFEST.permissions.setupWrite,

    fieldConfigSchema: examinationsFieldConfigPutBodySchema,
    loadFieldConfig: getExaminationFieldConfigService,
    saveFieldConfig: (body) => updateExaminationFieldConfigService(body),

    preferencesSchema: examinationsPreferencesPutBodySchema,
    loadPreferences: getExaminationPreferencesService,
    normalizePreferences: normalizeExaminationsModulePreferences,
    savePreferences: (normalized) => updateExaminationPreferencesService(normalized),

    audit: auditExaminations,
    fieldConfigAuditAction: "UPDATE_EXAMINATIONS_CONFIG",
    fieldConfigAuditSummary: "Updated examinations field configuration",
    preferencesAuditAction: "UPDATE_EXAMINATIONS_PREFERENCES",
    preferencesAuditSummary: "Updated examinations module preferences",
    loadFieldConfigError: "Failed to load examinations field config",
    saveFieldConfigError: "Failed to save examinations field config",
    loadPreferencesError: "Failed to load examinations preferences",
    savePreferencesError: "Failed to save examinations preferences",
  });
};
