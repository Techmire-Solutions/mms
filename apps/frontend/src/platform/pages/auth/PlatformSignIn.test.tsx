import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlatformSignIn from "./PlatformSignIn";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlatformLogin = vi.fn();
const mockPlatformVerify2FA = vi.fn();
const mockPlatformResend2FA = vi.fn();
let mockIsSubmitting = false;

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    platformLogin: mockPlatformLogin,
    platformVerify2FA: mockPlatformVerify2FA,
    platformResend2FA: mockPlatformResend2FA,
    isPlatformLoginSubmitting: mockIsSubmitting,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "platform.signInTitle": "Platform Console",
        "platform.signInSubtitle": "Sign in with your platform super-user credentials",
        "platform.twoFactorSubtitle": "Enter your 6-digit platform verification code",
        "platform.signIn": "Sign In",
        "platform.twoFactorVerify": "Verify & Enter Console",
        "platform.twoFactorVerifying": "Verifying…",
        "auth.twoFactorTitle": "Two-Factor Authentication",
        "auth.emailAddress": "Email Address",
        "auth.emailRequired": "Email is required",
        "auth.emailInvalid": "Enter a valid email address",
        "auth.password": "Password",
        "auth.passwordRequired": "Password is required",
        "auth.forgotPassword": "Forgot password?",
        "auth.signingIn": "Signing in…",
        "auth.otpIncomplete": "Please enter the 6-digit code",
        "auth.resendCode": "Resend Code",
        "auth.backToSignIn": "Back to Sign In",
        "entry.productName": "MMS",
        "entry.meta.platformSignIn": "Apex platform console sign-in",
      };
      if (key === "auth.resendCountdown" && params?.seconds) {
        return `Resend in ${params.seconds}s`;
      }
      return translations[key] ?? key;
    },
    dir: "ltr",
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/components/PlatformAuthLayout", () => ({
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="platform-auth-layout">
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      {children}
    </div>
  ),
}));

describe("PlatformSignIn", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
    mockIsSubmitting = false;
  });

  const renderComponent = async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<PlatformSignIn />);
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

  it("renders credentials step by default", async () => {
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(emailInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(submitButton.textContent).toContain("Sign In");
  });

  it("shows client-side validation errors when submitted empty", async () => {
    await renderComponent();

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockPlatformLogin).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Email is required");
  });

  it("submits valid credentials and logs in directly if 2FA not required", async () => {
    mockPlatformLogin.mockResolvedValueOnce({ requires2FA: false });
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      changeInput(emailInput, "admin@platform.test");
      changeInput(passwordInput, "SuperSecret123");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockPlatformLogin).toHaveBeenCalledWith("admin@platform.test", "SuperSecret123");
  });

  it("transitions to 2FA step when credentials require two-factor", async () => {
    mockPlatformLogin.mockResolvedValueOnce({ requires2FA: true, challengeId: "chal-999" });
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      changeInput(emailInput, "admin@platform.test");
      changeInput(passwordInput, "SuperSecret123");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Two-Factor Authentication");
    expect(container.textContent).toContain("Enter your 6-digit platform verification code");

    // OtpInput inputs should now be present (6 digit inputs)
    const otpInputs = container.querySelectorAll('input[inputmode="numeric"]');
    expect(otpInputs.length).toBe(6);

    // Verify back to sign in button allows returning to credentials step
    const backBtn = container.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(backBtn).not.toBeNull();
  });

  it("returns to credentials step when Back to Sign In is clicked from 2FA", async () => {
    mockPlatformLogin.mockResolvedValueOnce({ requires2FA: true, challengeId: "chal-999" });
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      changeInput(emailInput, "admin@platform.test");
      changeInput(passwordInput, "SuperSecret123");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    // Find the Back to Sign In button
    const buttons = Array.from(container.querySelectorAll("button"));
    const backBtn = buttons.find((b) => b.textContent?.includes("Back to Sign In"));
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it("submits 2FA code via platformVerify2FA when 6 digits entered", async () => {
    mockPlatformLogin.mockResolvedValueOnce({ requires2FA: true, challengeId: "chal-999" });
    mockPlatformVerify2FA.mockResolvedValueOnce(undefined);
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      changeInput(emailInput, "admin@platform.test");
      changeInput(passwordInput, "SuperSecret123");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const otpInputs = Array.from(
      container.querySelectorAll('input[inputmode="numeric"]'),
    ) as HTMLInputElement[];
    expect(otpInputs.length).toBe(6);

    await act(async () => {
      otpInputs.forEach((input, idx) => {
        changeInput(input, String(idx + 1));
      });
    });

    const twoFactorForm = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      twoFactorForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockPlatformVerify2FA).toHaveBeenCalledWith("chal-999", "123456");
  });

  it("displays error banner when credentials are rejected", async () => {
    mockPlatformLogin.mockRejectedValueOnce(new Error("Invalid platform credentials"));
    await renderComponent();

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      changeInput(emailInput, "wrong@platform.test");
      changeInput(passwordInput, "WrongPassword");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockPlatformLogin).toHaveBeenCalledWith("wrong@platform.test", "WrongPassword");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
