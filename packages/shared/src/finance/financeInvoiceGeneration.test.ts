import { describe, expect, it } from "vitest";
import {
  billingPeriodFromDate,
  buildInvoiceDraftFromEnrollment,
  dueDateForPeriod,
  isBillingPeriod,
  isEnrollmentBillable,
  shouldSkipGeneratedInvoice,
  generatedInvoiceCurrency,
} from "./financeInvoiceGeneration.js";

const enrollment = {
  id: "enr-1",
  studentId: "stu-1",
  studentName: "Amina",
  className: "Hifz A",
  sessionName: "2026-2027",
  sessionId: "ses-1",
  classId: "cls-1",
  enrolledDate: "2026-09-03",
  baseFee: 500,
  discountType: "sibling",
  discountPct: 10,
  discountAmt: 50,
  finalFee: 450,
  invoiceId: null,
  status: "confirmed",
};

describe("financeInvoiceGeneration", () => {
  it("derives YYYY-MM from an ISO date and rejects invalid input", () => {
    expect(billingPeriodFromDate("2026-09-05")).toBe("2026-09");
    expect(isBillingPeriod("2026-09")).toBe(true);
    expect(isBillingPeriod("2026-13")).toBe(false);
    expect(() => billingPeriodFromDate("09/05/2026")).toThrow(/YYYY-MM-DD/);
  });

  it("clamps due day to the last day of the billing month", () => {
    expect(dueDateForPeriod("2026-09", 15)).toBe("2026-09-15");
    expect(dueDateForPeriod("2026-02", 30)).toBe("2026-02-28");
    expect(dueDateForPeriod("2024-02", 31)).toBe("2024-02-29");
  });

  it("builds a pending invoice draft from enrollment fees", () => {
    expect(buildInvoiceDraftFromEnrollment(enrollment, "2026-09", 15)).toEqual({
      studentId: "stu-1",
      studentName: "Amina",
      class: "Hifz A",
      session: "2026-2027",
      baseFee: 500,
      discountType: "sibling",
      discountValue: 10,
      discountAmt: 50,
      finalAmt: 450,
      status: "pending",
      dueDate: "2026-09-15",
      paidAmt: 0,
      billingPeriod: "2026-09",
      enrollmentId: "enr-1",
    });
  });

  it("treats only pending and confirmed enrollments as billable", () => {
    expect(isEnrollmentBillable({ status: "pending" })).toBe(true);
    expect(isEnrollmentBillable({ status: "confirmed" })).toBe(true);
    expect(isEnrollmentBillable({ status: "cancelled" })).toBe(false);
  });

  it("skips once fees after any invoice and monthly fees only for the same period", () => {
    expect(
      shouldSkipGeneratedInvoice({
        frequency: "once",
        alreadyBilledThisPeriod: false,
        enrollmentHasAnyInvoice: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipGeneratedInvoice({
        frequency: "monthly",
        alreadyBilledThisPeriod: false,
        enrollmentHasAnyInvoice: true,
      }),
    ).toBe(false);
    expect(
      shouldSkipGeneratedInvoice({
        frequency: "monthly",
        alreadyBilledThisPeriod: true,
        enrollmentHasAnyInvoice: true,
      }),
    ).toBe(true);
  });
});

describe("generatedInvoiceCurrency", () => {
  const settings = { functionalCurrency: "PKR", enabledCurrencies: ["USD"] };

  it("given an enabled foreign session currency, should bill in it", () => {
    // Arrange / Act / Assert
    expect(generatedInvoiceCurrency("USD", settings)).toBe("USD");
  });

  it("given the functional currency, a disabled currency or none, should bill in the functional currency", () => {
    // Arrange / Act / Assert
    expect(generatedInvoiceCurrency("PKR", settings)).toBeUndefined();
    expect(generatedInvoiceCurrency("EUR", settings)).toBeUndefined();
    expect(generatedInvoiceCurrency(undefined, settings)).toBeUndefined();
  });
});
