import { z } from "zod";
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
    gradingScale: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const examinationsImportBodySchema = csvImportBodySchema(examinationsImportRowSchema);
export type ExaminationsImportBody = z.infer<typeof examinationsImportBodySchema>;

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

export const obligationsImportRowSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    representative: z.string().trim().max(200).optional(),
    donorName: z.string().trim().max(200).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    currency: z.string().trim().max(10).optional(),
    status: z.string().trim().max(50).optional(),
    dueDate: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

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
