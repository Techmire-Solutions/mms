import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step6Confirmation } from "./Step6Confirmation";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val?: number) => `$${val ?? 0}`,
  }),
}));

const mockStudent = {
  id: "std-1",
  name: "Bilal Ahmad",
  dob: "2015-01-01",
  gender: "male",
  fatherName: "Ahmad Tariq",
} as unknown as never;

const mockSession = {
  id: "ses-1",
  name: "Spring 2025",
  type: "Hifz",
  baseFee: 300,
} as unknown as never;

const mockClass = {
  id: "cls-1",
  name: "Hifz 1",
  facultyName: "Ustadh Khalid",
  ageMin: 7,
  ageMax: 12,
} as unknown as never;

const mockFeeResult = {
  id: "standard",
  label: "Standard",
  pct: 0,
  discountAmt: 0,
  finalFee: 300,
} as unknown as never;

describe("Step6Confirmation Component", () => {
  it("renders review confirmation sections and notes textarea", () => {
    const html = renderToStaticMarkup(
      <Step6Confirmation
        student={mockStudent}
        session={mockSession}
        classInfo={mockClass}
        feeResult={mockFeeResult}
        notes=""
        onNotesChange={vi.fn()}
        customFieldValues={{}}
        onCustomFieldChange={vi.fn()}
      />,
    );

    expect(html).toContain("Bilal Ahmad");
    expect(html).toContain("Spring 2025");
    expect(html).toContain("Hifz 1");
    expect(html).toContain("$300");
  });
});
