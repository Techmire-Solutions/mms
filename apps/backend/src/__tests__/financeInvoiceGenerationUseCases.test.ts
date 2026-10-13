import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

const mockBillingRepo = vi.hoisted(() => ({
  allocateInvoiceNumberBatch: vi.fn(),
  listFeeStructures: vi.fn(),
}));

const mockInvoicesRepo = vi.hoisted(() => ({
  bulkSaveInvoices: vi.fn(),
}));

const mockEnrollmentPersistRepo = vi.hoisted(() => ({
  linkEnrollmentInvoiceIds: vi.fn(),
}));

const mockGenRepo = vi.hoisted(() => ({
  listBillableEnrollments: vi.fn(),
  listEnrollmentInvoiceMarks: vi.fn(),
}));

const mockPrefs = vi.hoisted(() => ({
  loadFinanceModulePreferences: vi.fn(),
}));

const mockFinanceUseCases = vi.hoisted(() => ({
  financeUseCases: {
    createInvoice: vi.fn(),
  },
}));

const mockStudentRepo = vi.hoisted(() => ({
  findStudentsByIds: vi.fn(),
}));

const mockWs = vi.hoisted(() => ({
  broadcastTenantUpdate: vi.fn(),
}));

const mockEnrollmentRepo = vi.hoisted(() => ({
  findEnrollmentById: vi.fn(),
}));

vi.mock("../db/repositories/financeBillingRepository.js", () => mockBillingRepo);
vi.mock("../db/repositories/financeInvoicesRepository.js", () => mockInvoicesRepo);
vi.mock("../db/repositories/enrollmentRepositoryPersist.js", () => mockEnrollmentPersistRepo);
vi.mock("../db/repositories/financeInvoiceGenerationRepository.js", () => mockGenRepo);
vi.mock("../services/financePreferencesService.js", () => mockPrefs);
vi.mock("../finance/use-cases/financeUseCases.js", () => mockFinanceUseCases);
vi.mock("../db/repositories/studentRepository.js", () => mockStudentRepo);
vi.mock("../lib/livePush.js", () => mockWs);
vi.mock("../db/repositories/enrollmentRepository.js", () => mockEnrollmentRepo);

import {
  generateInvoices,
  maybeGenerateInvoiceForEnrollment,
} from "../finance/use-cases/financeInvoiceGenerationUseCases.js";

describe("financeInvoiceGenerationUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateInvoices", () => {
    it("throws without tenant", async () => {
      await expect(generateInvoices({ billingPeriod: "2026-09" })).rejects.toThrow(
        /Tenant context required/,
      );
    });

    it("generates batch invoices for billable enrollments and links invoice IDs", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({
        dueDays: "15",
        invoicePrefix: "INV",
      });
      mockBillingRepo.listFeeStructures.mockResolvedValue([
        {
          id: "fs-1",
          name: "Primary",
          session: "Session 1",
          className: "Grade 1",
          frequency: "monthly",
          isActive: true,
          items: [],
        },
      ]);
      mockGenRepo.listBillableEnrollments.mockResolvedValue([
        {
          id: "e-1",
          studentId: "s-1",
          studentName: "Student One",
          sessionName: "Session 1",
          className: "Grade 1",
          status: "confirmed",
          baseFee: 100,
          finalFee: 100,
          discountAmount: 0,
        },
        {
          id: "e-2",
          studentId: "s-2",
          studentName: "Student Two",
          sessionName: "Session 1",
          className: "Grade 1",
          status: "confirmed",
          baseFee: 150,
          finalFee: 150,
          discountAmount: 0,
        },
      ]);
      mockGenRepo.listEnrollmentInvoiceMarks.mockResolvedValue([]);
      mockStudentRepo.findStudentsByIds.mockResolvedValue([
        { id: "s-1", contactId: "c-1" },
        { id: "s-2", guardianContactId: "c-2" },
      ]);
      mockBillingRepo.allocateInvoiceNumberBatch.mockResolvedValue([
        "INV-2026-0001",
        "INV-2026-0002",
      ]);
      mockInvoicesRepo.bulkSaveInvoices.mockResolvedValue(undefined);
      mockEnrollmentPersistRepo.linkEnrollmentInvoiceIds.mockResolvedValue(undefined);

      const result = await runWithTenant("tenant-1", () =>
        generateInvoices({ billingPeriod: "2026-09" }),
      );

      expect(result).toEqual({ created: 2, skipped: 0, eligible: 2 });
      expect(mockBillingRepo.allocateInvoiceNumberBatch).toHaveBeenCalledWith(
        "tenant-1",
        2026,
        2,
        "INV",
      );
      expect(mockInvoicesRepo.bulkSaveInvoices).toHaveBeenCalledWith(
        "tenant-1",
        expect.arrayContaining([
          expect.objectContaining({ invoiceNumber: "INV-2026-0001", familyContactId: "c-1" }),
          expect.objectContaining({ invoiceNumber: "INV-2026-0002", familyContactId: "c-2" }),
        ]),
      );
      expect(mockEnrollmentPersistRepo.linkEnrollmentInvoiceIds).toHaveBeenCalledWith("tenant-1", [
        { enrollmentId: "e-1", invoiceId: expect.any(String) },
        { enrollmentId: "e-2", invoiceId: expect.any(String) },
      ]);
      expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
        "tenant-1",
        "collection",
        "finance_invoices",
      );
    });

    it("creates single invoice via createInvoice helper", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue(null);
      mockBillingRepo.listFeeStructures.mockResolvedValue([]);
      mockGenRepo.listBillableEnrollments.mockResolvedValue([
        {
          id: "e-1",
          studentId: "s-1",
          studentName: "Student One",
          sessionName: "Session 1",
          className: "Grade 1",
          status: "confirmed",
          baseFee: 100,
          finalFee: 100,
          discountAmount: 0,
        },
      ]);
      mockGenRepo.listEnrollmentInvoiceMarks.mockResolvedValue([]);
      mockStudentRepo.findStudentsByIds.mockResolvedValue([]);
      mockFinanceUseCases.financeUseCases.createInvoice.mockResolvedValue({
        id: "inv-single",
        enrollmentId: "e-1",
      });
      mockEnrollmentPersistRepo.linkEnrollmentInvoiceIds.mockResolvedValue(undefined);

      const result = await runWithTenant("tenant-1", () =>
        generateInvoices({ billingPeriod: "2026-09" }),
      );

      expect(result.created).toBe(1);
      expect(mockFinanceUseCases.financeUseCases.createInvoice).toHaveBeenCalled();
    });
  });

  describe("maybeGenerateInvoiceForEnrollment", () => {
    it("returns untouched enrollment if tenant is missing or not billable", async () => {
      const nonBillable = { id: "e-0", status: "dropped", finalFee: 100 } as any;
      const res = await maybeGenerateInvoiceForEnrollment(nonBillable);
      expect(res).toBe(nonBillable);
    });

    it("skips when autoGenerateInvoice preference is false", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({ autoGenerateInvoice: false });
      const enrollment = { id: "e-1", status: "active", finalFee: 100 } as any;

      const res = await runWithTenant("tenant-1", () =>
        maybeGenerateInvoiceForEnrollment(enrollment),
      );
      expect(res).toBe(enrollment);
    });

    it("generates invoice and refreshes enrollment when autoGenerate is true", async () => {
      mockPrefs.loadFinanceModulePreferences.mockResolvedValue({ autoGenerateInvoice: true });
      mockBillingRepo.listFeeStructures.mockResolvedValue([]);
      mockGenRepo.listBillableEnrollments.mockResolvedValue([
        {
          id: "e-1",
          studentId: "s-1",
          studentName: "Student One",
          sessionName: "Session 1",
          className: "Grade 1",
          status: "confirmed",
          baseFee: 100,
          finalFee: 100,
          discountAmount: 0,
        },
      ]);
      mockGenRepo.listEnrollmentInvoiceMarks.mockResolvedValue([]);
      mockStudentRepo.findStudentsByIds.mockResolvedValue([]);
      mockFinanceUseCases.financeUseCases.createInvoice.mockResolvedValue({
        id: "inv-1",
        enrollmentId: "e-1",
      });
      mockEnrollmentPersistRepo.linkEnrollmentInvoiceIds.mockResolvedValue(undefined);

      const refreshed = { id: "e-1", status: "confirmed", invoiceId: "inv-1" } as any;
      mockEnrollmentRepo.findEnrollmentById.mockResolvedValue(refreshed);

      const enrollment = {
        id: "e-1",
        status: "confirmed",
        finalFee: 100,
        enrolledDate: "2026-09-01",
      } as any;

      const res = await runWithTenant("tenant-1", () =>
        maybeGenerateInvoiceForEnrollment(enrollment),
      );
      expect(res).toBe(refreshed);
    });
  });
});
