import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step5FeeCalculation } from "./Step5FeeCalculation";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

const mockSession = {
  id: "ses-1",
  name: "Spring 2025",
  baseFee: 300,
  discounts: [],
} as unknown as never;

describe("Step5FeeCalculation Component", () => {
  it("renders fee breakdown card", () => {
    const html = renderToStaticMarkup(
      <Step5FeeCalculation
        student={null}
        session={mockSession}
        feeResult={null}
        onFeeResult={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.wizard.step5Title");
    expect(html).toContain("$300");
    expect(html).toContain("enrollments.wizard.step5FinalAmountDue");
  });
});
