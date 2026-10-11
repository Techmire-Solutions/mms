import type { FastifyPluginAsync } from "fastify";
import {
  ATTENDANCE_MODULE_MANIFEST,
  attendanceFieldConfigPutBodySchema,
  attendancePreferencesPutBodySchema,
  normalizeAttendanceModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../services/rbacService.js";
import {
  getAttendanceFieldConfigService,
  updateAttendanceFieldConfigService,
} from "../../services/attendanceConfigService.js";
import {
  getAttendancePreferencesService,
  updateAttendancePreferencesService,
} from "../../services/attendancePreferencesService.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";

const auditAttendance = createCollectionAuditHelper("attendance_records");

/** Attendance Setup field-config + preferences (typed FORCE-RLS tables). */
export const attendanceSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "attendance_records"),
    setupWritePermission: ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite,

    fieldConfigSchema: attendanceFieldConfigPutBodySchema,
    loadFieldConfig: getAttendanceFieldConfigService,
    saveFieldConfig: (body) => updateAttendanceFieldConfigService(body),

    preferencesSchema: attendancePreferencesPutBodySchema,
    loadPreferences: getAttendancePreferencesService,
    normalizePreferences: normalizeAttendanceModulePreferences,
    savePreferences: (normalized) => updateAttendancePreferencesService(normalized),

    audit: auditAttendance,
    fieldConfigAuditAction: "UPDATE_ATTENDANCE_CONFIG",
    fieldConfigAuditSummary: "Updated attendance field configuration",
    preferencesAuditAction: "UPDATE_ATTENDANCE_PREFERENCES",
    preferencesAuditSummary: "Updated attendance module preferences",
    loadFieldConfigError: "Failed to load attendance field config",
    saveFieldConfigError: "Failed to save attendance field config",
    loadPreferencesError: "Failed to load attendance preferences",
    savePreferencesError: "Failed to save attendance preferences",
  });
};
