import { z } from "zod";
import { FACULTY_PROFILE_STATUS_VALUES } from "./facultyTypes.js";

const isoCalendarDate = /^\d{4}-\d{2}-\d{2}$/;

/** One employ-designation tenure row in the faculty form (supports multiple cards). */
export const facultyEmployDesignationFormRowSchema = z
  .object({
    clientId: z.string().min(1).max(120),
    employDesignationId: z.string().max(100).nullish(),
    designationId: z.string().max(100),
    designationStartDate: z.string().regex(isoCalendarDate).nullish(),
    designationEndDate: z.string().regex(isoCalendarDate).nullish(),
    employDesignationStatus: z.enum(FACULTY_PROFILE_STATUS_VALUES).optional(),
  })
  .strict();

export type FacultyEmployDesignationFormRow = z.infer<typeof facultyEmployDesignationFormRowSchema>;

/** Write payload row (no client-only id). */
export const facultyEmployDesignationWriteRowSchema = facultyEmployDesignationFormRowSchema
  .omit({
    clientId: true,
  })
  .extend({
    designationId: z.string().min(1).max(100),
  });

export type FacultyEmployDesignationWriteRow = z.infer<
  typeof facultyEmployDesignationWriteRowSchema
>;

export const facultyEmployDesignationsWriteSchema = z
  .array(facultyEmployDesignationWriteRowSchema)
  .max(20);
