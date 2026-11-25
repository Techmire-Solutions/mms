import { z } from "zod";

/**
 * Paper (test) and assessment-result schemas.
 *
 * Extracted from `questionBankModuleManifest.ts` to keep the question manifest under the 300-line
 * ceiling; the manifest re-exports them so existing import paths are unchanged.
 */

export const questionBankTestRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    categoryId: z.string().nullable(),
    questionIds: z.array(z.string()),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
    duration: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    examClass: z.string().optional(),
    /** `session_classes.id`; `examClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    totalMarks: z.number().int().optional(),
    instructions: z.string().optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          instructions: z.string(),
          questionIds: z.array(z.string()),
        }),
      )
      .optional(),
    /** Publication stamp (0241) — set by `POST /tests/:id/publish`, never by the bulk write. */
    publishedAt: z.string().nullable().optional(),
    publishedBy: z.string().nullable().optional(),
    assemblySeed: z.string().max(64).nullable().optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
  })
  .strict();

export const questionBankTestInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    categoryId: z.string().nullable().optional(),
    questionIds: z.array(z.string()).default([]),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
    duration: z.number().int().positive().default(60),
    examClass: z.string().optional(),
    /** `session_classes.id`; `examClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    totalMarks: z.number().int().positive().optional(),
    instructions: z.string().optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          instructions: z.string(),
          questionIds: z.array(z.string()),
        }),
      )
      .optional(),
  })
  .strict();

export const questionBankTestUpdateSchema = questionBankTestInsertSchema.partial().strict();

export type QuestionBankTestInsert = z.infer<typeof questionBankTestInsertSchema>;
export type QuestionBankTestUpdate = z.infer<typeof questionBankTestUpdateSchema>;
export const questionBankTestListSchema = z.array(questionBankTestRecordSchema);

export const questionBankResultRecordSchema = z
  .object({
    id: z.string(),
    testId: z.string(),
    studentId: z.string(),
    studentName: z.string(),
    submittedAt: z.string(),
    answers: z.record(z.string(), z.string()).default({}),
    scores: z.record(z.string(), z.number()).default({}),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const questionBankResultInsertSchema = z
  .object({
    id: z.string().optional(),
    testId: z.string(),
    studentId: z.string(),
    studentName: z.string().default(""),
    submittedAt: z.string(),
    answers: z.record(z.string(), z.string()).default({}),
    scores: z.record(z.string(), z.number()).default({}),
  })
  .strict();

export const questionBankResultUpdateSchema = questionBankResultInsertSchema.partial().strict();

export type QuestionBankResultInsert = z.infer<typeof questionBankResultInsertSchema>;
export type QuestionBankResultUpdate = z.infer<typeof questionBankResultUpdateSchema>;
export const questionBankResultListSchema = z.array(questionBankResultRecordSchema);
