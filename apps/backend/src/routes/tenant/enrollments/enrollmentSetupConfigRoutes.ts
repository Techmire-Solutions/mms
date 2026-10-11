import type { FastifyPluginAsync } from "fastify";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  enrollmentFieldConfigPutBodySchema,
  enrollmentPreferencesPutBodySchema,
  normalizeEnrollmentModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  loadEnrollmentFieldConfig,
  saveEnrollmentFieldConfig,
} from "../../../services/enrollmentConfigService.js";
import {
  loadEnrollmentModulePreferences,
  saveEnrollmentModulePreferences,
} from "../../../services/enrollmentPreferencesService.js";
import { auditEnrollment } from "./enrollmentRouteHelpers.js";

/** Enrollments Setup field-config + preferences (typed FORCE-RLS tables). */
export const enrollmentSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "enrollments"),
    setupWritePermission: ENROLLMENTS_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: enrollmentFieldConfigPutBodySchema,
    preferencesSchema: enrollmentPreferencesPutBodySchema,
    loadFieldConfig: loadEnrollmentFieldConfig,
    saveFieldConfig: (body) => saveEnrollmentFieldConfig(body),
    loadPreferences: loadEnrollmentModulePreferences,
    normalizePreferences: normalizeEnrollmentModulePreferences,
    savePreferences: saveEnrollmentModulePreferences,
    audit: auditEnrollment,
    fieldConfigAuditAction: "enrollment.field-config",
    fieldConfigAuditSummary: "Updated enrollment field configuration",
    preferencesAuditAction: "enrollment.preferences",
    preferencesAuditSummary: "Updated enrollment module preferences",
    loadFieldConfigError: "Failed to load enrollment field config",
    saveFieldConfigError: "Failed to save enrollment field config",
    loadPreferencesError: "Failed to load enrollment preferences",
    savePreferencesError: "Failed to save enrollment preferences",
  });
};
