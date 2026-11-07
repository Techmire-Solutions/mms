import { z } from "zod";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import { isoDateSchema } from "../core/isoDateSchema.js";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");

/** One timetable period row (class/section resolved by id or unique name). */
export const sessionTimetableImportRowSchema = z
  .object({
    classId: z.string().trim().max(64).optional(),
    className: z.string().trim().max(255).optional(),
    sectionId: z.string().trim().max(64).optional(),
    sectionName: z.string().trim().max(255).optional(),
    date: isoDateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    subject: z.string().trim().min(1).max(255),
    subjectId: z.string().trim().max(64).optional(),
    facultyId: z.string().trim().max(64).optional(),
    facultyName: z.string().trim().max(255).optional(),
    room: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (!row.classId && !row.className)
      ctx.addIssue({ code: "custom", message: "classId or className is required" });
    if (row.startTime >= row.endTime)
      ctx.addIssue({ code: "custom", message: "startTime must be before endTime" });
  });

export const sessionTimetableImportBodySchema = z.preprocess(
  deepSanitizeStrings,
  z
    .object({
      rows: z.array(sessionTimetableImportRowSchema).min(1).max(500),
      dryRun: z.boolean().optional(),
    })
    .strict(),
);
export type SessionTimetableImportBody = z.infer<typeof sessionTimetableImportBodySchema>;
