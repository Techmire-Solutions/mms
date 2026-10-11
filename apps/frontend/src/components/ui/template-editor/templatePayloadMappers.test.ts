import { describe, expect, it } from "vitest";
import {
  mapToTypstFeeReceipt,
  mapToTypstReportCard,
  mapToTypstFinancialLedger,
  mapToZohoInvoice,
} from "./templatePayloadMappers";

describe("templatePayloadMappers", () => {
  it("maps fee receipt data directly to Typst compiler JSON payload", () => {
    const rawData = {
      institution: "Madrasa Al-Hikmah",
      receiptNo: "REC-9912",
      date: "2026-09-12",
      studentName: "Ahmad Tariq",
      rollNo: "R-102",
      className: "Hifz 1",
      feeItems: [{ description: "Tuition", amount: "200.00", paid: "200.00" }],
      totalAmount: "200.00",
      paidAmount: "200.00",
      balance: "0.00",
      paymentMethod: "Cash",
      transactionRef: "TXN-1",
    };

    const payload = mapToTypstFeeReceipt(rawData);

    expect(payload.receiptNo).toBe("REC-9912");
    expect(payload.studentName).toBe("Ahmad Tariq");
    expect(payload.feeItems).toHaveLength(1);
    expect(payload.feeItems[0]?.description).toBe("Tuition");
    expect(payload.totalAmount).toBe("200.00");
    expect(payload.balance).toBe("0.00");
  });

  it("maps student marks data directly to Typst report-card.typ payload", () => {
    const rawData = {
      institution: "Madrasa Al-Hikmah",
      studentName: "Bilal Habashi",
      rollNumber: "EX-501",
      className: "Level 3",
      term: "Mid-Term",
      academicYear: "1447",
      subjects: [
        { name: "Quran", maxMarks: 100, obtainedMarks: 95, grade: "A+", remarks: "MashaAllah" },
      ],
      totalMarks: 100,
      obtainedMarks: 95,
      percentage: "95%",
      grade: "A+",
      attendance: "99%",
      remarks: "Excellent conduct",
    };

    const payload = mapToTypstReportCard(rawData);

    expect(payload.studentName).toBe("Bilal Habashi");
    expect(payload.rollNumber).toBe("EX-501");
    expect(payload.subjects[0]?.grade).toBe("A+");
    expect(payload.totalMarks).toBe(100);
    expect(payload.obtainedMarks).toBe(95);
  });

  it("maps accounting data directly to Typst financial-ledger.typ payload", () => {
    const rawData = {
      institution: "Madrasa Central",
      period: "Q3 2026",
      currency: "USD",
      entries: [
        {
          date: "2026-09-01",
          accountCode: "4001",
          description: "Tuition Income",
          debit: "0.00",
          credit: "1500.00",
          balance: "1500.00",
        },
      ],
      totalDebit: "0.00",
      totalCredit: "1500.00",
      netBalance: "1500.00",
    };

    const payload = mapToTypstFinancialLedger(rawData);

    expect(payload.period).toBe("Q3 2026");
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]?.accountCode).toBe("4001");
    expect(payload.totalCredit).toBe("1500.00");
  });

  it("maps invoice records directly to Zoho Invoice sync schema", () => {
    const rawData = {
      invoice_number: "INV-2026-778",
      date: "2026-09-12",
      due_date: "2026-09-26",
      customer_id: "CUST-441",
      customer_name: "Tariq Jamil",
      line_items: [
        {
          name: "Annual Tuition",
          description: "Term 1",
          rate: "450.00",
          quantity: 1,
          item_total: "450.00",
        },
      ],
      total: "450.00",
      balance: "450.00",
      currency_code: "USD",
    };

    const payload = mapToZohoInvoice(rawData);

    expect(payload.invoice_number).toBe("INV-2026-778");
    expect(payload.customer_name).toBe("Tariq Jamil");
    expect(payload.line_items).toHaveLength(1);
    expect(payload.line_items[0]?.rate).toBe("450.00");
    expect(payload.total).toBe("450.00");
  });
});
