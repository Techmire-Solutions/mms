import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreditNote, Invoice, Payment } from "@mms/shared";
import {
  invoiceAuditState,
  paymentAuditState,
  recordCreditNoteAudit,
  recordInvoiceAudit,
  recordPaymentAudit,
} from "../finance/use-cases/financeAuditEvents.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(),
}));

const TENANT = "tenant-finance";

describe("financeAuditEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("invoiceAuditState", () => {
    it("given null or undefined invoice, should return null", () => {
      expect(invoiceAuditState(null)).toBeNull();
      expect(invoiceAuditState(undefined)).toBeNull();
    });

    it("given invoice with PII and string amounts, should return minimised projection with numbers and exclude PII", () => {
      // Arrange
      const rawInvoice = {
        id: "inv-100",
        studentId: "stu-42",
        studentName: "Ahmad Zahid", // PII to exclude
        notes: "Sensitive internal note", // PII to exclude
        status: "unpaid",
        finalAmt: "1500.50",
        paidAmt: "500.00",
        creditedAmt: "100.00",
        dueDate: "2026-05-01",
      } as unknown as Invoice;

      // Act
      const result = invoiceAuditState(rawInvoice, "settlement_cancel");

      // Assert
      expect(result).toEqual({
        id: "inv-100",
        studentId: "stu-42",
        status: "unpaid",
        finalAmt: 1500.5,
        paidAmt: 500,
        creditedAmt: 100,
        dueDate: "2026-05-01",
        event: "settlement_cancel",
      });
      expect(result).not.toHaveProperty("studentName");
      expect(result).not.toHaveProperty("notes");
    });
  });

  describe("paymentAuditState", () => {
    it("given payment with null student and fallback invoiceAmount, should map numeric amounts cleanly", () => {
      // Arrange
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        studentId: null,
        amount: 250,
        invoiceAmount: undefined,
        date: "2026-04-15",
        method: "bank_transfer",
      } as unknown as Payment;

      // Act
      const result = paymentAuditState(payment);

      // Assert
      expect(result).toEqual({
        id: "pay-1",
        invoiceId: "inv-1",
        studentId: null,
        amount: 250,
        invoiceAmount: 250,
        date: "2026-04-15",
        method: "bank_transfer",
      });
    });
  });

  describe("recordInvoiceAudit", () => {
    it("given null invoice, should return early without recording audit event", async () => {
      // Act
      await recordInvoiceAudit(TENANT, "UPDATE", null);

      // Assert
      expect(recordModernAuditEvent).not.toHaveBeenCalled();
    });

    it("given valid invoice, should delegate to recordModernAuditEvent with finance_invoices table", async () => {
      // Arrange
      const invoice = {
        id: "inv-200",
        studentId: "stu-99",
        status: "paid",
        finalAmt: 300,
        paidAmt: 300,
        creditedAmt: 0,
        dueDate: "2026-06-01",
      } as unknown as Invoice;
      const oldState = {
        id: "inv-200",
        studentId: "stu-99",
        status: "unpaid",
        finalAmt: 300,
        paidAmt: 0,
        creditedAmt: 0,
        dueDate: "2026-06-01",
      };

      // Act
      await recordInvoiceAudit(TENANT, "UPDATE", invoice, oldState, "paid_event");

      // Assert
      expect(recordModernAuditEvent).toHaveBeenCalledWith({
        workspaceSubdomain: TENANT,
        tableName: "finance_invoices",
        recordId: "inv-200",
        actionType: "UPDATE",
        oldState,
        newState: {
          id: "inv-200",
          studentId: "stu-99",
          status: "paid",
          finalAmt: 300,
          paidAmt: 300,
          creditedAmt: 0,
          dueDate: "2026-06-01",
          event: "paid_event",
        },
      });
    });
  });

  describe("recordPaymentAudit", () => {
    it("given payment, should delegate to recordModernAuditEvent with finance_payments table and CREATE action", async () => {
      // Arrange
      const payment: Payment = {
        id: "pay-99",
        invoiceId: "inv-200",
        studentId: "stu-99",
        amount: 300,
        invoiceAmount: 300,
        date: "2026-04-20",
        method: "cash",
      } as unknown as Payment;

      // Act
      await recordPaymentAudit(TENANT, payment);

      // Assert
      expect(recordModernAuditEvent).toHaveBeenCalledWith({
        workspaceSubdomain: TENANT,
        tableName: "finance_payments",
        recordId: "pay-99",
        actionType: "CREATE",
        newState: {
          id: "pay-99",
          invoiceId: "inv-200",
          studentId: "stu-99",
          amount: 300,
          invoiceAmount: 300,
          date: "2026-04-20",
          method: "cash",
        },
      });
    });
  });

  describe("recordCreditNoteAudit", () => {
    it("given credit note, should delegate to recordModernAuditEvent with finance_credit_notes table", async () => {
      // Arrange
      const note: CreditNote = {
        id: "cn-1",
        invoiceId: "inv-200",
        amount: 50,
      } as unknown as CreditNote;

      // Act
      await recordCreditNoteAudit(TENANT, note, 50);

      // Assert
      expect(recordModernAuditEvent).toHaveBeenCalledWith({
        workspaceSubdomain: TENANT,
        tableName: "finance_credit_notes",
        recordId: "cn-1",
        actionType: "CREATE",
        newState: {
          id: "cn-1",
          invoiceId: "inv-200",
          amount: 50,
          creditedAmt: 50,
        },
      });
    });
  });
});
