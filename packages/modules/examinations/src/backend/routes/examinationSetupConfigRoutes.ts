import type { FastifyPluginAsync } from "fastify";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examinationsFieldConfigPutBodySchema,
  examinationsPreferencesPutBodySchema,
  normalizeExaminationsModulePreferences,
} from "@mms/contracts";
import { registerModuleSetupConfigRoutes } from "@mms/be-core/http/routes";
import { canReadCollection } from "@mms/be-core/rbac";
import {
  getExaminationFieldConfigService,
  updateExaminationFieldConfigService,
} from "../services/index.js";
import {
  getExaminationPreferencesService,
  updateExaminationPreferencesService,
} from "../services/index.js";
import { createCollectionAuditHelper } from "@mms/be-core/http/routes";

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
