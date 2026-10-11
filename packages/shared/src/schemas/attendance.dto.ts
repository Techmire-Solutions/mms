import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";
import {
  attendanceRecordInsertSchema,
  attendanceRecordUpdateSchema,
  attendanceLeaveInsertSchema,
} from "../attendanceModuleManifest.js";

const attendanceBulkIdsBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

export const attendanceBulkIdsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, attendanceBulkIdsBaseSchema);

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
