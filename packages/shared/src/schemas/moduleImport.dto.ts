import { z } from "zod";
import { csvImportBodySchema } from "./csvImport.dto.js";

export const studentImportRowSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    grNumber: z.string().trim().max(100).optional(),
    studentId: z.string().trim().max(100).optional(),
    gender: z.string().trim().max(50).optional(),
    dob: z.string().trim().max(50).optional(),
    cnic: z.string().trim().max(50).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().max(255).optional(),
    city: z.string().trim().max(100).optional(),
    fatherName: z.string().trim().max(200).optional(),
    motherName: z.string().trim().max(200).optional(),
    guardianName: z.string().trim().max(200).optional(),
    status: z.string().trim().max(50).optional(),
    registeredDate: z.string().trim().max(50).optional(),
    enrolledSessions: z.string().trim().max(500).optional(),
    discountType: z.string().trim().max(100).optional(),
    discountPct: z.number().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const studentsImportBodySchema = csvImportBodySchema(studentImportRowSchema);
export type StudentsImportBody = z.infer<typeof studentsImportBodySchema>;

export const sessionImportRowSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    type: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    startDate: z.string().trim().max(50).optional(),
    endDate: z.string().trim().max(50).optional(),
    duration: z.string().trim().max(100).optional(),
    baseFee: z.union([z.string(), z.number()]).optional(),
    currency: z.string().trim().max(10).optional(),
    capacity: z.number().optional(),
    description: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const sessionsImportBodySchema = csvImportBodySchema(sessionImportRowSchema);
export type SessionsImportBody = z.infer<typeof sessionsImportBodySchema>;

export const enrollmentImportRowSchema = z
  .object({
    studentName: z.string().trim().max(200).optional(),
    studentId: z.string().trim().max(100).optional(),
    sessionName: z.string().trim().max(200).optional(),
    sessionId: z.string().trim().max(100).optional(),
    className: z.string().trim().max(200).optional(),
    enrolledDate: z.string().trim().max(50).optional(),
    baseFee: z.union([z.string(), z.number()]).optional(),
    discountType: z.string().trim().max(100).optional(),
    discountPct: z.number().optional(),
    finalFee: z.union([z.string(), z.number()]).optional(),
    status: z.string().trim().max(50).optional(),
    paymentStatus: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const enrollmentsImportBodySchema = csvImportBodySchema(enrollmentImportRowSchema);
export type EnrollmentsImportBody = z.infer<typeof enrollmentsImportBodySchema>;

export const userImportRowSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().max(255).optional(),
    role: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    phone: z.string().trim().max(50).optional(),
    twoFactorEnabled: z.union([z.boolean(), z.string()]).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const usersImportBodySchema = csvImportBodySchema(userImportRowSchema);
export type UsersImportBody = z.infer<typeof usersImportBodySchema>;

export const questionBankImportRowSchema = z
  .object({
    title: z.string().trim().max(500).optional(),
    category: z.string().trim().max(200).optional(),
    difficulty: z.string().trim().max(50).optional(),
    type: z.string().trim().max(50).optional(),
    points: z.union([z.string(), z.number()]).optional(),
    explanation: z.string().trim().max(2000).optional(),
    source: z.string().trim().max(200).optional(),
    status: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const questionBankImportBodySchema = csvImportBodySchema(questionBankImportRowSchema);
export type QuestionBankImportBody = z.infer<typeof questionBankImportBodySchema>;

export const accountingImportRowSchema = z
  .object({
    code: z.string().trim().max(50).optional(),
    name: z.string().trim().max(200).optional(),
    type: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    currency: z.string().trim().max(10).optional(),
    balance: z.union([z.string(), z.number()]).optional(),
    status: z.string().trim().max(50).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const accountingImportBodySchema = csvImportBodySchema(accountingImportRowSchema);
export type AccountingImportBody = z.infer<typeof accountingImportBodySchema>;

export const financeImportRowSchema = z
  .object({
    invoiceNumber: z.string().trim().max(100).optional(),
    recipient: z.string().trim().max(200).optional(),
    issueDate: z.string().trim().max(50).optional(),
    dueDate: z.string().trim().max(50).optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    currency: z.string().trim().max(10).optional(),
    status: z.string().trim().max(50).optional(),
    paymentMethod: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const financeImportBodySchema = csvImportBodySchema(financeImportRowSchema);
export type FinanceImportBody = z.infer<typeof financeImportBodySchema>;

export * from "./opsModuleImport.dto.js";
