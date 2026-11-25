import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { type Student } from "@/lib/data/studentsData";
import { type CalculatedFee } from "@/lib/data/enrollmentData";
import { Step5FeeCalculation } from "./Step5FeeCalculation";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", () => ({
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

const staffStudent = {
  id: "std-1",
  discountType: "staff",
  discountPct: 50,
} as unknown as Student;

describe("Step5FeeCalculation Component", () => {
  it("renders fee breakdown card", () => {
    const html = renderToStaticMarkup(
      <Step5FeeCalculation
        student={null}
        session={mockSession}
        classInfo={null}
        feeResult={null}
        onFeeResult={vi.fn()}
      />,
    );

    expect(html).toContain("enrollments.wizard.step5Title");
    expect(html).toContain("$300");
    expect(html).toContain("enrollments.wizard.step5FinalAmountDue");
  });

  it("recomputes and reports the fee when the student discount changes", async () => {
    const onFeeResult = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Step5FeeCalculation
          student={null}
          session={mockSession}
          classInfo={null}
          feeResult={null}
          onFeeResult={onFeeResult}
        />,
      );
    });
    const first = onFeeResult.mock.calls.at(-1)?.[0] as CalculatedFee;
    expect(first.pct).toBe(0);
    expect(first.finalFee).toBe(300);

    await act(async () => {
      root.render(
        <Step5FeeCalculation
          student={staffStudent}
          session={mockSession}
          classInfo={null}
          feeResult={null}
          onFeeResult={onFeeResult}
        />,
      );
    });
    const second = onFeeResult.mock.calls.at(-1)?.[0] as CalculatedFee;
    expect(second.pct).toBe(50);
    expect(second.finalFee).toBe(150);

    await act(async () => {
      root.unmount();
    });
  });
});
