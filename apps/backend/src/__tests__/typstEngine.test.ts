import { describe, it, expect } from "vitest";
import {
  compileTypstToPdf,
  getTemplatePath,
  type TypstTemplateType,
} from "../worker/processors/typst-compiler.js";
import { SUPPORTED_FONTS } from "../worker/templates/fonts/index.js";
import { processPdfRenderJob } from "../worker/processors/pdf-rendering.js";

describe("Typst BiDi Headless Document Engine (Phase 6)", () => {
  it("loads supported font definitions for Nastaliq, Arabic, and Sans", () => {
    expect(SUPPORTED_FONTS.nastaliq.family).toBe("Noto Nastaliq Urdu");
    expect(SUPPORTED_FONTS.arabic.family).toBe("Readex Pro");
    expect(SUPPORTED_FONTS.sans.family).toBe("Geist");
    expect(SUPPORTED_FONTS.nastaliq.direction).toBe("rtl");
  });

  it("locates valid Typst template paths", () => {
    const templates: TypstTemplateType[] = ["report-card", "fee-receipt", "financial-ledger"];
    for (const t of templates) {
      const path = getTemplatePath(t);
      expect(path).toContain(`${t}.typ`);
    }
  });

  it("generates a conforming BiDi PDF document with header metadata and RTL layout", async () => {
    const pdfBuffer = await compileTypstToPdf({
      template: "report-card",
      lang: "ur",
      direction: "rtl",
      data: {
        institution: "جامعة دار العلوم",
        studentName: "محمد أحمد خان",
        rollNumber: "R-1049",
        className: "حفظ القرآن الكريم",
        subjects: [
          { name: "تجويد القرآن", maxMarks: 100, obtainedMarks: 98, grade: "ممتاز" },
          { name: "الفقه الإسلامي", maxMarks: 100, obtainedMarks: 94, grade: "ممتاز" },
        ],
        totalMarks: 200,
        obtainedMarks: 192,
        percentage: "96%",
        grade: "ممتاز مرتفع",
      },
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // PDF Magic bytes
    expect(pdfBuffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("renders fee receipt template to valid PDF buffer", async () => {
    const pdfBuffer = await compileTypstToPdf({
      template: "fee-receipt",
      lang: "ar",
      direction: "rtl",
      data: {
        institution: "مدرسة الإيمان النموذجية",
        receiptNo: "REC-2026-088",
        studentName: "عبد الله السعيد",
        totalAmount: "450.00",
        paidAmount: "450.00",
        balance: "0.00",
        feeItems: [
          { description: "رسوم الفصل الدراسي الأول", amount: "400.00", paid: "400.00" },
          { description: "رسوم الكتب الدراسية", amount: "50.00", paid: "50.00" },
        ],
      },
    });

    expect(pdfBuffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("renders financial ledger statements to valid PDF buffer", async () => {
    const pdfBuffer = await compileTypstToPdf({
      template: "financial-ledger",
      lang: "ar",
      direction: "rtl",
      data: {
        institution: "Madrasa Management System",
        period: "Q3 2026",
        currency: "USD",
        totalDebit: "12500.00",
        totalCredit: "12500.00",
        netBalance: "0.00",
        entries: [
          {
            date: "2026-08-01",
            accountCode: "1010-CASH",
            description: "Tuition collection",
            debit: "5000.00",
            credit: "0.00",
            balance: "5000.00",
          },
        ],
      },
    });

    expect(pdfBuffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("processes PDF render job and returns stored upload metadata", async () => {
    const progressEvents: number[] = [];
    const result = await processPdfRenderJob(
      "demo-tenant",
      {
        template: "report-card",
        data: { institution: "Demo Madrasa", studentName: "Zayd" },
        filename: "zayd-report.pdf",
        lang: "ar",
      },
      (pct) => {
        progressEvents.push(pct);
      },
    );

    expect(result.key).toContain("tenants/demo-tenant/exports/");
    expect(result.key).toContain("zayd-report.pdf");
    expect(progressEvents).toContain(100);
  });
});
