import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { EnrollmentWizard } from "./EnrollmentWizard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessions: () => ({
    data: { status: 200, body: { sessions: [] } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useEnrollmentConfig: () => ({ fields: {}, customFields: [] }),
}));

const student = { id: "std-1", name: "Bilal Ahmad", status: "active", gender: "male" };

vi.mock("./wizard/Step1SelectStudent", () => ({
  Step1SelectStudent: ({ onChange }: { onChange: (value: typeof student) => void }) => (
    <button type="button" data-testid="pick-student" onClick={() => onChange(student)}>
      Pick student
    </button>
  ),
}));
vi.mock("./wizard/Step2SelectSession", () => ({ Step2SelectSession: () => null }));
vi.mock("./wizard/Step3Eligibility", () => ({ Step3Eligibility: () => null }));
vi.mock("./wizard/Step4ClassAssignment", () => ({ Step4ClassAssignment: () => null }));
vi.mock("./wizard/Step5FeeCalculation", () => ({ Step5FeeCalculation: () => null }));
vi.mock("./wizard/Step6Confirmation", () => ({ Step6Confirmation: () => null }));
vi.mock("./wizard/StepIndicator", () => ({ StepIndicator: () => null }));
vi.mock("./EnrollmentWizardFooter", () => ({ EnrollmentWizardFooter: () => null }));

describe("EnrollmentWizard dirty state", () => {
  it("reports a dirty draft to the hosting modal so closing is guarded", async () => {
    const onDirtyChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <EnrollmentWizard onComplete={vi.fn()} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />,
      );
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await act(async () => {
      (container.querySelector('[data-testid="pick-student"]') as HTMLButtonElement).click();
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
