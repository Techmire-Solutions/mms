import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Step3Eligibility } from "./Step3Eligibility";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const mockStudent = {
  id: "std-1",
  name: "Bilal Ahmad",
  dob: "2015-01-01",
  gender: "male",
} as unknown as never;

const mockSession = {
  id: "ses-1",
  name: "Spring 2025",
} as unknown as never;

describe("Step3Eligibility Component", () => {
  it("renders eligibility evaluation and passed badge", () => {
    const html = renderToStaticMarkup(
      <Step3Eligibility student={mockStudent} session={mockSession} suggestedClass={null} />,
    );

    expect(html).toContain("enrollments.wizard.step3Title");
    expect(html).toContain("enrollments.wizard.step3Passed");
  });
});
