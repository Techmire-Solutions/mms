import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PlatformSignIn from "./PlatformSignIn";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlatformLogin = vi.fn();
const mockPlatformVerify2FA = vi.fn();
const mockPlatformResend2FA = vi.fn();

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
    isPlatformLoginSubmitting: false,
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "platform.signInTitle": "Platform Console",
        "platform.signInSubtitle": "Sign in with your platform super-user credentials",
        "platform.twoFactorSubtitle": "Enter your 6-digit platform verification code",
        "auth.twoFactorSubtitleBoth": "Enter the 6-digit code sent to your email and SMS",
        "auth.twoFactorSubtitleSms": "Enter the 6-digit code sent by SMS",
        "auth.twoFactorTitle": "Two-Factor Authentication",
      };
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

describe("PlatformSignIn 2FA delivery channels", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
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

  it("shows dual channel subtitle when login requires 2FA with channel both", async () => {
    mockPlatformLogin.mockResolvedValueOnce({
      requires2FA: true,
      challengeId: "chal-both",
      channel: "both",
    });
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

    expect(container.textContent).toContain("Enter the 6-digit code sent to your email and SMS");
  });

  it("shows SMS channel subtitle when login requires 2FA with channel sms", async () => {
    mockPlatformLogin.mockResolvedValueOnce({
      requires2FA: true,
      challengeId: "chal-sms",
      channel: "sms",
    });
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

    expect(container.textContent).toContain("Enter the 6-digit code sent by SMS");
  });
});
