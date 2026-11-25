import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentWizard } from "./EnrollmentWizard";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessions: () => ({
    data: { status: 200, body: { sessions: [] } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSessionsCollection: () => [],
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useEnrollmentConfig: () => ({
    fields: {},
    customFields: [],
  }),
}));

vi.mock("@/lib/data/enrollmentData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/enrollmentData")>();
  return { ...actual, suggestClass: () => null, runFullEligibility: () => [] };
});

vi.mock("./wizard/StepIndicator", () => ({
  StepIndicator: () => <div data-testid="step-indicator">Step Indicator</div>,
}));

const student = { id: "std-1", name: "Bilal Ahmad", status: "active", gender: "male" };
const session = { id: "ses-1", name: "Session 2026", baseFee: 100 };
const classInfo = { id: "cls-1", name: "Grade 1", sections: [] };
const feeResult = { id: "none", label: "None", pct: 0, discountAmt: 0, finalFee: 100 };

vi.mock("./wizard/Step1SelectStudent", () => ({
  Step1SelectStudent: ({ onChange }: { onChange: (value: typeof student) => void }) => (
    <button type="button" data-testid="pick-student" onClick={() => onChange(student)}>
      Step 1 Select Student
    </button>
  ),
}));

vi.mock("./wizard/Step2SelectSession", () => ({
  Step2SelectSession: ({ onChange }: { onChange: (value: typeof session) => void }) => (
    <button type="button" data-testid="pick-session" onClick={() => onChange(session)}>
      pick session
    </button>
  ),
}));
vi.mock("./wizard/Step3Eligibility", () => ({ Step3Eligibility: () => null }));
vi.mock("./wizard/Step4ClassAssignment", () => ({
  Step4ClassAssignment: ({ onChange }: { onChange: (value: typeof classInfo) => void }) => (
    <button type="button" data-testid="pick-class" onClick={() => onChange(classInfo)}>
      pick class
    </button>
  ),
}));
vi.mock("./wizard/Step5FeeCalculation", () => ({
  Step5FeeCalculation: ({ onFeeResult }: { onFeeResult: (value: typeof feeResult) => void }) => (
    <button type="button" data-testid="pick-fee" onClick={() => onFeeResult(feeResult)}>
      pick fee
    </button>
  ),
}));
vi.mock("./wizard/Step6Confirmation", () => ({ Step6Confirmation: () => null }));

vi.mock("./EnrollmentWizardFooter", () => ({
  EnrollmentWizardFooter: ({
    onCancel,
    onPrevious,
    onNext,
    onSubmit,
  }: {
    onCancel: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSubmit: () => void;
  }) => (
    <div data-testid="wizard-footer">
      Wizard Footer
      <button type="button" data-testid="wizard-cancel" onClick={onCancel}>
        cancel
      </button>
      <button type="button" data-testid="wizard-previous" onClick={onPrevious}>
        previous
      </button>
      <button type="button" data-testid="wizard-next" onClick={onNext}>
        next
      </button>
      <button type="button" data-testid="wizard-submit" onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}));

function click(container: HTMLElement, testId: string): Promise<void> {
  return act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
  });
}

describe("EnrollmentWizard Component", () => {
  it("renders wizard step indicator, initial step, and footer", () => {
    const html = renderToStaticMarkup(<EnrollmentWizard onComplete={vi.fn()} onCancel={vi.fn()} />);

    expect(html).toContain("Step Indicator");
    expect(html).toContain("Step 1 Select Student");
    expect(html).toContain("Wizard Footer");
  });
});

describe("EnrollmentWizard submitting state", () => {
  it("reports onSubmittingChange(true) while the completion promise is pending, then false", async () => {
    /**
     * Regression: the wizard never told its host that the enrollment POST was in
     * flight, so the hosting FormModal stayed dismissible during the request and
     * the draft could be closed (and discarded) while it was being saved.
     */
    let resolveComplete: () => void = () => undefined;
    const onComplete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        }),
    );
    const onSubmittingChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EnrollmentWizard
          onComplete={onComplete}
          onCancel={vi.fn()}
          onSubmittingChange={onSubmittingChange}
        />,
      );
    });
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);

    await click(container, "pick-student");
    await click(container, "wizard-next");
    await click(container, "pick-session");
    await click(container, "wizard-next");
    await click(container, "wizard-next");
    await click(container, "pick-class");
    await click(container, "wizard-next");
    await click(container, "pick-fee");
    await click(container, "wizard-next");
    await click(container, "wizard-submit");

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSubmittingChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      resolveComplete();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSubmittingChange).toHaveBeenLastCalledWith(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
