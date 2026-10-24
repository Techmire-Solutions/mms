import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ForgotPassword from "./ForgotPassword";
import { ROUTES } from "@/lib/config/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();
const mockRequestPasswordOtp = vi.fn();
const mockVerifyPasswordOtp = vi.fn();
const mockResetPasswordWithOtp = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/tenant/components/AuthLayout", () => ({
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      {subtitle ? <h2>{subtitle}</h2> : null}
      {children}
    </div>
  ),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    requestPasswordOtp: mockRequestPasswordOtp,
    verifyPasswordOtp: mockVerifyPasswordOtp,
    resetPasswordWithOtp: mockResetPasswordWithOtp,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    passwordPolicy: "strong",
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "auth.forgotTitle": "Forgot Password",
        "auth.forgotSubtitle": "Enter your email to receive a reset code",
        "auth.forgotEnterCodeTitle": "Enter Verification Code",
        "auth.forgotNewPasswordTitle": "Set New Password",
        "auth.emailAddress": "Email Address",
        "auth.emailRequired": "Email is required",
        "auth.emailInvalid": "Invalid email address",
        "auth.sendCode": "Send Code",
        "auth.sendingResetLink": "Sending...",
        "auth.otpIncomplete": "Please enter the full 6-digit code",
        "auth.otpInvalid": "Invalid or expired code",
        "auth.verifySignIn": "Verify & Continue",
        "auth.verifying": "Verifying...",
        "auth.password": "Password",
        "auth.forgotConfirmPasswordLabel": "Confirm Password",
        "auth.forgotPasswordMismatch": "Passwords do not match",
        "auth.setPassword": "Set Password",
        "auth.settingPassword": "Setting password...",
        "auth.passwordSetSuccess": "Password reset successfully",
        "auth.backToSignIn": "Back to Sign In",
        "auth.codeSentTo": "Code sent to",
        "auth.resendCode": "Resend code",
        "auth.resendCountdown": `Resend code in ${params?.seconds ?? ""}s`,
        "entry.productName": "MMS",
        "entry.meta.tenantForgot": "Reset your madrasa password",
        "global.passwordPolicyErrorMin12": "Password must be at least 12 characters.",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("ForgotPassword", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockNavigate.mockReset();
    mockRequestPasswordOtp.mockReset();
    mockVerifyPasswordOtp.mockReset();
    mockResetPasswordWithOtp.mockReset();
    mockNotifySuccess.mockReset();
  });

  const render = async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ForgotPassword />);
    });
    return root;
  };

  const changeInput = (input: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("renders initial email form and validates empty submission", async () => {
    const root = await render();
    const form = container.querySelector("form");

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Email is required");
    expect(mockRequestPasswordOtp).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("validates invalid email format", async () => {
    const root = await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;

    act(() => {
      changeInput(emailInput, "not-an-email");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Invalid email address");
    expect(mockRequestPasswordOtp).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("progresses through full flow: email -> otp -> reset", async () => {
    mockRequestPasswordOtp.mockResolvedValueOnce(undefined);
    mockVerifyPasswordOtp.mockResolvedValueOnce(undefined);
    mockResetPasswordWithOtp.mockResolvedValueOnce(undefined);

    const root = await render();

    // 1. Submit email
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    act(() => {
      changeInput(emailInput, "user@example.com");
    });

    let form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockRequestPasswordOtp).toHaveBeenCalledWith("user@example.com");
    expect(container.textContent).toContain("Enter Verification Code");

    // 2. Fill OTP digits
    const otpInputs = container.querySelectorAll<HTMLInputElement>('input[id^="otp-"]');
    expect(otpInputs.length).toBe(6);

    act(() => {
      ["1", "2", "3", "4", "5", "6"].forEach((digit, idx) => {
        changeInput(otpInputs[idx], digit);
      });
    });

    form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockVerifyPasswordOtp).toHaveBeenCalledWith("user@example.com", "123456");
    expect(container.textContent).toContain("Set New Password");

    // 3. Fill new password and confirm password
    const passwordInputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(passwordInputs.length).toBe(2);

    act(() => {
      changeInput(passwordInputs[0], "StrongPassword123!@#");
      changeInput(passwordInputs[1], "StrongPassword123!@#");
    });

    form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockResetPasswordWithOtp).toHaveBeenCalledWith(
      "user@example.com",
      "123456",
      "StrongPassword123!@#",
    );
    expect(mockNotifySuccess).toHaveBeenCalledWith("Password reset successfully");
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.home, { replace: true });

    act(() => {
      root.unmount();
    });
  });

  it("validates password policy during reset step", async () => {
    mockRequestPasswordOtp.mockResolvedValueOnce(undefined);
    mockVerifyPasswordOtp.mockResolvedValueOnce(undefined);

    const root = await render();

    // 1. Submit email
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    act(() => {
      changeInput(emailInput, "user@example.com");
    });
    let form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // 2. Submit OTP
    const otpInputs = container.querySelectorAll<HTMLInputElement>('input[id^="otp-"]');
    act(() => {
      ["1", "2", "3", "4", "5", "6"].forEach((digit, idx) => {
        changeInput(otpInputs[idx], digit);
      });
    });
    form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // 3. Enter weak password
    const passwordInputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    act(() => {
      changeInput(passwordInputs[0], "Short1!");
      changeInput(passwordInputs[1], "Short1!");
    });

    form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Password must be at least 12 characters.");
    expect(mockResetPasswordWithOtp).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
