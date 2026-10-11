/**
 * @file typstDocumentPayloadTypes.ts
 * @description Strict Zod schemas & types for Typst worker queue payloads.
 */

import { z } from "zod";

export const typstFeeItemSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    paid: z.string(),
  })
  .strict();

export type TypstFeeItem = z.infer<typeof typstFeeItemSchema>;

export const typstFeeReceiptPayloadSchema = z
  .object({
    institution: z.string(),
    receiptNo: z.string(),
    date: z.string(),
    studentName: z.string(),
    rollNo: z.string(),
    className: z.string(),
    feeItems: z.array(typstFeeItemSchema),
    totalAmount: z.string(),
    paidAmount: z.string(),
    balance: z.string(),
    paymentMethod: z.string(),
    transactionRef: z.string(),
  })
  .strict();

export type TypstFeeReceiptPayload = z.infer<typeof typstFeeReceiptPayloadSchema>;

export const typstReportCardSubjectSchema = z
  .object({
    name: z.string(),
    maxMarks: z.number(),
    obtainedMarks: z.number(),
    grade: z.string(),
    remarks: z.string().optional().default(""),
  })
  .strict();

export type TypstReportCardSubject = z.infer<typeof typstReportCardSubjectSchema>;

export const typstReportCardPayloadSchema = z
  .object({
    institution: z.string(),
    studentName: z.string(),
    rollNumber: z.string(),
    className: z.string(),
    term: z.string(),
    academicYear: z.string(),
    subjects: z.array(typstReportCardSubjectSchema),
    totalMarks: z.number(),
    obtainedMarks: z.number(),
    percentage: z.string(),
    grade: z.string(),
    attendance: z.string(),
    remarks: z.string(),
  })
  .strict();

export type TypstReportCardPayload = z.infer<typeof typstReportCardPayloadSchema>;

export const typstLedgerEntrySchema = z
  .object({
    date: z.string(),
    accountCode: z.string(),
    description: z.string(),
    debit: z.string(),
    credit: z.string(),
    balance: z.string(),
  })
  .strict();

export type TypstLedgerEntry = z.infer<typeof typstLedgerEntrySchema>;

export const typstFinancialLedgerPayloadSchema = z
  .object({
    institution: z.string(),
    period: z.string(),
    currency: z.string(),
    entries: z.array(typstLedgerEntrySchema),
    totalDebit: z.string(),
    totalCredit: z.string(),
    netBalance: z.string(),
  })
  .strict();

export type TypstFinancialLedgerPayload = z.infer<typeof typstFinancialLedgerPayloadSchema>;
