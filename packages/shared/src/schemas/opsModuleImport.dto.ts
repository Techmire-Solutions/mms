import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { nonNegativeMoneyDecimalAmountSchema } from "../money/moneySchemas.js";
import { csvImportBodySchema } from "./csvImport.dto.js";

export const attendanceImportRowSchema = z
  .object({
    date: z.string().trim().max(50).optional(),
    personName: z.string().trim().max(200).optional(),
    personType: z.string().trim().max(50).optional(),
    sessionName: z.string().trim().max(200).optional(),
    className: z.string().trim().max(200).optional(),
    status: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const attendanceImportBodySchema = csvImportBodySchema(attendanceImportRowSchema);
export type AttendanceImportBody = z.infer<typeof attendanceImportBodySchema>;

export const examinationsImportRowSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    subject: z.string().trim().max(200).optional(),
    examDate: z.string().trim().max(50).optional(),
    totalMarks: z.union([z.string(), z.number()]).optional(),
    passingMarks: z.union([z.string(), z.number()]).optional(),
    /** Session class name. Required: an exam with no class has no roster and can never be marked. */
    className: z.string().trim().max(255).optional(),
    status: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const examinationsImportBodySchema = csvImportBodySchema(examinationsImportRowSchema);
export type ExaminationsImportBody = z.infer<typeof examinationsImportBodySchema>;

/** One row of a marks import: a roll number resolved against the exam's own roster. */
export const examMarksImportRowSchema = z
  .object({
    rollNumber: z.string().trim().min(1).max(64),
    // An empty cell must fail, not coerce to 0 (a false zero mark).
    marksObtained: z.union([z.number().finite(), z.string().trim().min(1).max(20)]),
  })
  .strict();

export const examMarksImportBodySchema = z
  .object({
    rows: z.array(examMarksImportRowSchema).min(1).max(5_000),
    label: z.string().trim().max(300).optional(),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
  })
  .strict();

export type ExamMarksImportRow = z.infer<typeof examMarksImportRowSchema>;
export type ExamMarksImportBody = z.infer<typeof examMarksImportBodySchema>;

export const hasanatImportRowSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    category: z.string().trim().max(100).optional(),
    targetPerson: z.string().trim().max(200).optional(),
    points: z.union([z.string(), z.number()]).optional(),
    date: z.string().trim().max(50).optional(),
    description: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const hasanatImportBodySchema = csvImportBodySchema(hasanatImportRowSchema);
export type HasanatImportBody = z.infer<typeof hasanatImportBodySchema>;

/**
 * One obligation **receipt** row — the document the import dialog actually asks for.
 *
 * This schema used to be a copy of the tasks blueprint: `title`, `status` and `dueDate` (an
 * obligation receipt has none of those), no receipt fields required, and `.passthrough()` so a real
 * row passed unvalidated. The dialog builds its columns from `obligationsTransferSchema` (the SSOT),
 * so the two disagreed and the endpoint validated the wrong document (audit T5).
 *
 * The field set and its requiredness now mirror the SSOT transfer schema exactly, so a file the
 * dialog generates is a file this schema accepts — and the invented fields are rejected as unknown
 * keys instead of being silently carried.
 */
export const obligationsImportRowSchema = z
  .object({
    receiptNo: z.string().trim().min(1).max(100),
    receivedDate: isoDateSchema,
    donorName: z.string().trim().min(1).max(200),
    representative: z.string().trim().min(1).max(200),
    // A decimal string at the column's scale (numeric(12,2)). A JS number would reintroduce float
    // rounding before the value ever reaches the database, so the string form is required and the
    // scale is bounded to two decimals (`check:money-safety`).
    amount: z.preprocess(
      // A spreadsheet/JSON parser may hand us a number; stringify before validation so the value is
      // judged as written. A float that is not exactly representable ("0.30000000000000004") is
      // then rejected by the scale rule rather than rounded into a cent nobody entered.
      (value) => (typeof value === "number" ? String(value) : value),
      nonNegativeMoneyDecimalAmountSchema.refine(
        (value) => /^-?\d{1,12}(\.\d{1,2})?$/.test(value),
        { message: "obligations.import.amountScale" },
      ),
    ),
    currency: z.string().trim().min(3).max(10).optional(),
    // The receipt DTO's own enum — anything else cannot be stored.
    paymentMode: z.enum(["Cash", "Online"]).optional(),
    reference: z.string().trim().max(200).optional(),
  })
  .strict();

export const obligationsImportBodySchema = csvImportBodySchema(obligationsImportRowSchema);
export type ObligationsImportBody = z.infer<typeof obligationsImportBodySchema>;

export const tasksImportRowSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    assignee: z.string().trim().max(200).optional(),
    priority: z.string().trim().max(50).optional(),
    status: z.string().trim().max(50).optional(),
    dueDate: z.string().trim().max(50).optional(),
    description: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const tasksImportBodySchema = csvImportBodySchema(tasksImportRowSchema);
export type TasksImportBody = z.infer<typeof tasksImportBodySchema>;

export const messagingImportRowSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    channel: z.string().trim().max(50).optional(),
    recipient: z.string().trim().max(200).optional(),
    message: z.string().trim().max(5000).optional(),
    status: z.string().trim().max(50).optional(),
    sentAt: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const messagingImportBodySchema = csvImportBodySchema(messagingImportRowSchema);
export type MessagingImportBody = z.infer<typeof messagingImportBodySchema>;
