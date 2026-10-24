import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_INITIAL_DATA, ONBOARDING_STEP_DEFS } from "./onboardingWizardTypes";
import { useOnboardingWizardController } from "./useOnboardingWizardController";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockOnboard = vi.fn();
const mockNavigate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    onboard: mockOnboard,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useOnboardingWizardController", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("defines valid initial onboarding state", () => {
    expect(ONBOARDING_INITIAL_DATA.name).toBe("");
    expect(ONBOARDING_INITIAL_DATA.subdomain).toBe("");
    expect(ONBOARDING_INITIAL_DATA.email).toBe("");
    expect(ONBOARDING_INITIAL_DATA.agreedTerms).toBe(false);
    expect(ONBOARDING_INITIAL_DATA.industryType).toBe("madrasa");
  });

  it("contains five onboarding wizard steps", () => {
    expect(ONBOARDING_STEP_DEFS.length).toBe(5);
    expect(ONBOARDING_STEP_DEFS.map((step) => step.id)).toEqual([1, 2, 3, 4, 5]);
    expect(ONBOARDING_STEP_DEFS[0]?.labelKey).toBe("onboarding.stepOrgLabel");
    expect(ONBOARDING_STEP_DEFS[4]?.labelKey).toBe("onboarding.stepCompleteLabel");
  });

  it("submits onboarding without password when admin password is omitted", async () => {
    mockOnboard.mockResolvedValue({ user: { id: "u-1" }, workspace: { id: "w-1" } });
    let controller!: ReturnType<typeof useOnboardingWizardController>;

    function TestComponent() {
      controller = useOnboardingWizardController();
      return null;
    }

    await act(async () => {
      root!.render(React.createElement(TestComponent));
    });

    act(() => {
      controller.setData({
        ...ONBOARDING_INITIAL_DATA,
        name: "Test Madrasa",
        subdomain: "test-madrasa",
        firstName: "Ali",
        lastName: "Raza",
        email: "ali@test.com",
        agreedTerms: true,
        currentPassword: "operator-stepup-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).toHaveBeenCalledWith(
      expect.objectContaining({
        madrasaName: "Test Madrasa",
        subdomain: "test-madrasa",
        adminName: "Ali Raza",
        email: "ali@test.com",
        password: undefined,
        currentPassword: "operator-stepup-password",
      }),
    );
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("rejects completion when operator step-up password is empty", async () => {
    let controller!: ReturnType<typeof useOnboardingWizardController>;

    function TestComponent() {
      controller = useOnboardingWizardController();
      return null;
    }

    await act(async () => {
      root!.render(React.createElement(TestComponent));
    });

    act(() => {
      controller.setData({
        ...ONBOARDING_INITIAL_DATA,
        name: "Test Madrasa",
        subdomain: "test-madrasa",
        firstName: "Ali",
        lastName: "Raza",
        email: "ali@test.com",
        agreedTerms: true,
        currentPassword: "",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).not.toHaveBeenCalled();
    expect(controller.submitError).toBe("platform.validationConfirmPlatformPassword");
  });
});
