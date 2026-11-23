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
    warning: vi.fn(),
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
    expect(ONBOARDING_INITIAL_DATA.adminGender).toBe("");
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
        adminGender: "male",
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
        adminGender: "male",
        adminPasswordMode: "email",
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
        adminGender: "male",
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

  it("blocks completion without an administrator gender", async () => {
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
        adminGender: "",
        currentPassword: "operator-stepup-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).not.toHaveBeenCalled();
    expect(controller.submitError).toBe("onboarding.errorAdminGender");
  });

  it("requires a temporary password when the temporary mode is selected", async () => {
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
        adminGender: "male",
        adminPasswordMode: "temporary",
        password: "",
        passwordConfirm: "",
        currentPassword: "operator-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).not.toHaveBeenCalled();
    expect(controller.submitError).toBe("onboarding.errorPasswordRequired");
  });

  it("rejects a mismatched temporary-password confirmation", async () => {
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
        adminGender: "male",
        adminPasswordMode: "temporary",
        password: "TempPassword123!",
        passwordConfirm: "Different123!",
        currentPassword: "operator-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).not.toHaveBeenCalled();
    expect(controller.submitError).toBe("onboarding.errorPasswordMismatch");
  });

  it("submits the temporary password with its mode", async () => {
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
        adminGender: "male",
        adminPasswordMode: "temporary",
        password: "TempPassword123!",
        passwordConfirm: "TempPassword123!",
        currentPassword: "operator-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(mockOnboard).toHaveBeenCalledWith(
      expect.objectContaining({
        adminPasswordMode: "temporary",
        password: "TempPassword123!",
      }),
    );
  });

  it("warns when the activation email could not be sent", async () => {
    mockOnboard.mockResolvedValue({
      user: { id: "u-1" },
      workspace: { id: "w-1" },
      inviteEmailSent: false,
      inviteEmailError: "No outgoing mail server is configured",
    });
    const { notify } = await import("@/lib/notify");
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
        adminGender: "male",
        adminPasswordMode: "email",
        currentPassword: "operator-password",
      });
      controller.setStep(5);
    });

    await act(async () => {
      controller.handleNext();
    });

    expect(notify.warning).toHaveBeenCalledWith(
      "onboarding.emailFailedTitle",
      expect.objectContaining({ description: "No outgoing mail server is configured" }),
    );
  });
});
