import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { students } from "../students.js";
import { enrollments } from "../enrollments.js";
import { financeInvoices, financePayments } from "../finance.js";
import {
  financeFeeStructures,
  financeFeeItems,
  financeInvoiceLines,
  financePaymentAllocations,
} from "../financeBilling.js";
import { financeCreditNotes } from "../financeCollect.js";

export const financeInvoicesRelations = relations(financeInvoices, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [financeInvoices.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  student: one(students, {
    fields: [financeInvoices.workspaceSubdomain, financeInvoices.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
  payments: many(financePayments),
  lines: many(financeInvoiceLines),
  allocations: many(financePaymentAllocations),
  feeStructure: one(financeFeeStructures, {
    fields: [financeInvoices.workspaceSubdomain, financeInvoices.feeStructureId],
    references: [financeFeeStructures.workspaceSubdomain, financeFeeStructures.id],
  }),
  enrollment: one(enrollments, {
    fields: [financeInvoices.workspaceSubdomain, financeInvoices.enrollmentId],
    references: [enrollments.workspaceSubdomain, enrollments.id],
  }),
  creditNotes: many(financeCreditNotes),
}));

export const financePaymentsRelations = relations(financePayments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [financePayments.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  invoice: one(financeInvoices, {
    fields: [financePayments.workspaceSubdomain, financePayments.invoiceId],
    references: [financeInvoices.workspaceSubdomain, financeInvoices.id],
  }),
  allocations: many(financePaymentAllocations),
}));

export const financeCreditNotesRelations = relations(financeCreditNotes, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [financeCreditNotes.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  invoice: one(financeInvoices, {
    fields: [financeCreditNotes.workspaceSubdomain, financeCreditNotes.invoiceId],
    references: [financeInvoices.workspaceSubdomain, financeInvoices.id],
  }),
}));

export const financeFeeStructuresRelations = relations(financeFeeStructures, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [financeFeeStructures.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  items: many(financeFeeItems),
  invoices: many(financeInvoices),
}));

export const financeFeeItemsRelations = relations(financeFeeItems, ({ one }) => ({
  structure: one(financeFeeStructures, {
    fields: [financeFeeItems.workspaceSubdomain, financeFeeItems.structureId],
    references: [financeFeeStructures.workspaceSubdomain, financeFeeStructures.id],
  }),
}));

export const financeInvoiceLinesRelations = relations(financeInvoiceLines, ({ one }) => ({
  invoice: one(financeInvoices, {
    fields: [financeInvoiceLines.workspaceSubdomain, financeInvoiceLines.invoiceId],
    references: [financeInvoices.workspaceSubdomain, financeInvoices.id],
  }),
}));

export const financePaymentAllocationsRelations = relations(
  financePaymentAllocations,
  ({ one }) => ({
    payment: one(financePayments, {
      fields: [financePaymentAllocations.workspaceSubdomain, financePaymentAllocations.paymentId],
      references: [financePayments.workspaceSubdomain, financePayments.id],
    }),
    invoice: one(financeInvoices, {
      fields: [financePaymentAllocations.workspaceSubdomain, financePaymentAllocations.invoiceId],
      references: [financeInvoices.workspaceSubdomain, financeInvoices.id],
    }),
  }),
);
