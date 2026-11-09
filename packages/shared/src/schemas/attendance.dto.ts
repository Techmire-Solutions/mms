import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  attendanceRecordInsertSchema,
  attendanceRecordUpdateSchema,
  attendanceLeaveInsertSchema,
} from "../attendance/attendanceModuleManifest.js";

/**
 * Soft-delete reason for attendance marks.
 *
 * `ATTENDANCE_MODULE_MANIFEST.softDelete.captureDeletionReason` is `true`, but the contract handlers
 * bypassed `shouldCaptureDeletionReason`, so deletions could be recorded with no justification.
 * Attendance is evidence: an archived mark must say why it was archived.
 */
export const attendanceDeletionReasonSchema = z.string().trim().min(3).max(500);

const attendanceBulkIdsBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    deletionReason: attendanceDeletionReasonSchema,
  })
  .strict();

export const attendanceBulkIdsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceBulkIdsBaseSchema);

/** Restore carries no justification: the archived row already records why it was removed. */
const attendanceBulkRestoreBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
  })
  .strict();

export const attendanceBulkRestoreIdsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceBulkRestoreBaseSchema);

export const attendanceCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceRecordInsertSchema);

export const attendanceUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceRecordUpdateSchema);

export const attendanceLeaveCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceLeaveInsertSchema);
