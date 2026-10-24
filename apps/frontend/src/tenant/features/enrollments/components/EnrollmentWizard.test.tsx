import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentWizard } from "./EnrollmentWizard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useEnrollmentConfig: () => ({
    fields: {},
    customFields: [],
  }),
}));

vi.mock("./wizard/StepIndicator", () => ({
  StepIndicator: () => <div data-testid="step-indicator">Step Indicator</div>,
}));

vi.mock("./wizard/Step1SelectStudent", () => ({
  Step1SelectStudent: () => <div data-testid="step-1">Step 1 Select Student</div>,
}));

vi.mock("./EnrollmentWizardFooter", () => ({
  EnrollmentWizardFooter: () => <div data-testid="wizard-footer">Wizard Footer</div>,
}));

describe("EnrollmentWizard Component", () => {
  it("renders wizard step indicator, initial step, and footer", () => {
    const html = renderToStaticMarkup(<EnrollmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(html).toContain("Step Indicator");
    expect(html).toContain("Step 1 Select Student");
    expect(html).toContain("Wizard Footer");
  });
});
