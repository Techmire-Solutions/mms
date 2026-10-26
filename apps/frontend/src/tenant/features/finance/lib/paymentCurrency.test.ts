import { describe, expect, it } from "vitest";
import { invoiceAmountInPaymentCurrency } from "./paymentCurrency";
import { formatDocumentAmount } from "./documentAmount";

describe("invoiceAmountInPaymentCurrency", () => {
  it("given a USD balance paid in PKR at 285, should express it as PKR", () => {
    // Arrange / Act / Assert
    expect(invoiceAmountInPaymentCurrency(1000, "USD", "PKR", "PKR", "285")).toBe(285000);
  });

  it("given a PKR balance paid in USD at 280, should express it as USD", () => {
    // Arrange / Act / Assert
    expect(invoiceAmountInPaymentCurrency(28000, "PKR", "USD", "PKR", "280")).toBe(100);
  });

  it("given no usable rate, should return null instead of assuming 1", () => {
    // Arrange / Act / Assert
    expect(invoiceAmountInPaymentCurrency(1000, "USD", "PKR", "PKR", "")).toBeNull();
    expect(invoiceAmountInPaymentCurrency(1000, "USD", "USD", "PKR", "")).toBe(1000);
  });
});

describe("formatDocumentAmount", () => {
  it("given a foreign document, should format in its currency; otherwise use the module formatter", () => {
    // Arrange
    const functional = (amount: number) => `PKR-${amount}`;

    // Act / Assert
    expect(formatDocumentAmount({ currency: "USD" }, 12.5, functional)).toMatch(/^\$ 12\.5/);
    expect(formatDocumentAmount({}, 12.5, functional)).toBe("PKR-12.5");
  });
});
