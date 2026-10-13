import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import TwoFactorAuth from "./TwoFactorAuth";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();
const mockVerify2FA = vi.fn();
const mockResend2FA = vi.fn(async () => mockResendSuccess);
let mockIsAuthenticated = false;
let mockUser: any = null;
let mockPendingChallengeId: string | null = "challenge-123";
let mockIs2FAVerified = false;
let mockRequiresTwoFactor = true;
let mockResendSuccess = true;

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: { from: "/dashboard" } }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
    verify2FA: mockVerify2FA,
    resend2FA: mockResend2FA,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    security: { twoFactorAuth: "required" },
    notifications: { defaultChannel: "email" },
  }),
}));

vi.mock("@mms/shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mms/shared")>();
  return {
    ...original,
    requiresTwoFactor: () => mockRequiresTwoFactor,
  };
});

vi.mock("@/lib/twoFactor", () => ({
  getPendingChallengeId: () => mockPendingChallengeId,
  is2FAVerified: () => mockIs2FAVerified,
  resend2FACode: vi.fn(async () => mockResendSuccess),
}));

vi.mock("@/tenant/components/AuthLayout", () => ({
  default: ({ title, subtitle, children }: any) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      {children}
    </div>
  ),
}));

vi.mock("@/components/entry", () => ({
  EntryPageHead: () => null,
  formatEntryTitle: (t: string) => t,
  AuthBackLink: ({ to, label }: any) => <a href={to}>{label}</a>,
  AuthMutedPanel: ({ children }: any) => <div data-testid="muted-panel">{children}</div>,
  AuthResendCodeControl: ({ onResend, disabled, resendLabel }: any) => (
    <button data-testid="resend-btn" onClick={onResend} disabled={disabled}>
      {resendLabel}
    </button>
  ),
  AuthStatusBanner: ({ message }: any) => <div data-testid="status-banner">{message}</div>,
  AuthSubmitButton: ({ busy, label, disabled }: any) => (
    <button type="submit" data-testid="submit-btn" disabled={disabled || busy}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/app/OtpInput", () => ({
  createEmptyOtp: () => ["", "", "", "", "", ""],
  isOtpComplete: (code: string[]) => code.every((digit) => digit.length === 1),
  OtpInput: ({ value: _value, onChange, disabled }: any) => (
    <div data-testid="otp-input">
      <button
        data-testid="fill-otp"
        disabled={disabled}
        onClick={() => onChange(["1", "2", "3", "4", "5", "6"])}
      >
        Fill OTP
      </button>
    </div>
  ),
}));

describe("TwoFactorAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockUser = null;
    mockPendingChallengeId = "challenge-123";
    mockIs2FAVerified = false;
    mockRequiresTwoFactor = true;
    mockResendSuccess = true;
  });

  it("redirects to /login if no challenge exists and unauthenticated", () => {
    mockPendingChallengeId = null;
    mockIsAuthenticated = false;

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    const nav = container.querySelector('[data-testid="navigate"]');
    expect(nav?.getAttribute("data-to")).toBe("/login");

    act(() => {
      root.unmount();
    });
  });

  it("redirects to target path if authenticated and 2FA is not required or already verified", () => {
    mockIsAuthenticated = true;
    mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User",
      email: "u@test.com",
      role: "admin",
    });
    mockRequiresTwoFactor = false;

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    const nav = container.querySelector('[data-testid="navigate"]');
    expect(nav?.getAttribute("data-to")).toBe("/dashboard");

    act(() => {
      root.unmount();
    });
  });

  it("renders 2FA form when pending challenge exists", () => {
    mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User",
      email: "user@example.com",
      role: "admin",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    expect(container.querySelector('[data-testid="auth-layout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="otp-input"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("submits valid OTP and navigates to target path", async () => {
    mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User",
      email: "user@example.com",
      role: "admin",
    });
    mockVerify2FA.mockResolvedValueOnce(undefined);

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    const fillOtpBtn = container.querySelector('[data-testid="fill-otp"]');
    act(() => {
      fillOtpBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockVerify2FA).toHaveBeenCalledWith("123456");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });

    act(() => {
      root.unmount();
    });
  });

  it("displays error message on invalid OTP submission", async () => {
    mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User",
      email: "user@example.com",
      role: "admin",
    });
    mockVerify2FA.mockRejectedValueOnce(new Error("Invalid code"));

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    const fillOtpBtn = container.querySelector('[data-testid="fill-otp"]');
    act(() => {
      fillOtpBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-testid="status-banner"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("triggers resend OTP code", async () => {
    mockUser = normalizeWorkspaceUser({
      id: "u1",
      name: "User",
      email: "user@example.com",
      role: "admin",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<TwoFactorAuth />);
    });

    const resendBtn = container.querySelector('[data-testid="resend-btn"]');
    await act(async () => {
      resendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockResend2FA).toHaveBeenCalledWith("challenge-123");
    expect(container.querySelector('[data-testid="auth-layout"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
