import type { FastifyPluginAsync } from "fastify";
import {
  STUDENTS_MODULE_MANIFEST,
  studentFieldConfigPutBodySchema,
  studentPreferencesPutBodySchema,
  normalizeStudentModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  loadStudentFieldConfig,
  saveStudentFieldConfig,
} from "../../../students/use-cases/studentConfigService.js";
import {
  loadStudentModulePreferences,
  saveStudentModulePreferences,
} from "../../../students/use-cases/studentPreferencesService.js";
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
