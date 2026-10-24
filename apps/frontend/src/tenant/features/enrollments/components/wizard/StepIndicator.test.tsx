import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { User, BookOpen } from "lucide-react";
import { StepIndicator } from "./StepIndicator";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@shared/ui", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@shared/ui");
  return {
    ...actual,
    WizardStepIndicator: ({ steps, current }: { steps: { label: string }[]; current: number }) => (
      <div data-testid="step-indicator">
        <span>Current: {current}</span>
        <span>{steps.map((s) => s.label).join(", ")}</span>
      </div>
    ),
  };
});

describe("StepIndicator Component", () => {
  it("renders wizard step indicator", () => {
    const html = renderToStaticMarkup(
      <StepIndicator
        steps={[
          { id: "student", label: "Student", icon: User },
          { id: "session", label: "Session", icon: BookOpen },
        ]}
        current={0}
      />,
    );

    expect(html).toContain("Current: 0");
    expect(html).toContain("Student, Session");
  });
});
