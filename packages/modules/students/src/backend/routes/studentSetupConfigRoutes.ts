import type { FastifyPluginAsync } from "fastify";
import {
  STUDENTS_MODULE_MANIFEST,
  studentFieldConfigPutBodySchema,
  studentPreferencesPutBodySchema,
  normalizeStudentModulePreferences,
} from "@mms/contracts";
import { registerModuleSetupConfigRoutes } from "../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "@mms/be-core/rbac";
import { loadStudentFieldConfig, saveStudentFieldConfig } from "../use-cases/index.js";
import { loadStudentModulePreferences, saveStudentModulePreferences } from "../use-cases/index.js";
import { auditStudent } from "./studentRouteHelpers.js";

/** Students Setup field-config + preferences (typed FORCE-RLS tables). */
export const studentSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "students"),
    setupWritePermission: STUDENTS_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: studentFieldConfigPutBodySchema,
    preferencesSchema: studentPreferencesPutBodySchema,
    loadFieldConfig: loadStudentFieldConfig,
    saveFieldConfig: (body) => saveStudentFieldConfig(body),
    loadPreferences: loadStudentModulePreferences,
    normalizePreferences: normalizeStudentModulePreferences,
    savePreferences: saveStudentModulePreferences,
    audit: auditStudent,
    fieldConfigAuditAction: "student.field-config",
    fieldConfigAuditSummary: "Updated student field configuration",
    preferencesAuditAction: "student.preferences",
    preferencesAuditSummary: "Updated student module preferences",
    loadFieldConfigError: "Failed to load student field config",
    saveFieldConfigError: "Failed to save student field config",
    loadPreferencesError: "Failed to load student preferences",
    savePreferencesError: "Failed to save student preferences",
  });
};
