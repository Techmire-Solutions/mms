import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Login from "./Login";
import { AuthFailureError } from "@/lib/contexts/authContextHelpers";
import { REMEMBER_EMAIL_KEY } from "./loginRememberEmail";

import { ROUTES } from "@/lib/config/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockExchangeHandoff = vi.fn();
let mockIsAuthenticated = false;
let mockUser: { id: string; email: string; role: string; mustChangePassword?: boolean } | null =
  null;
let mockRequiresTwoFactor = false;

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: "", state: { from: "/dashboard" } }),
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className} data-testid={`link-${to}`}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    exchangeHandoff: mockExchangeHandoff,
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    security: { twoFactorAuth: "optional" },
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
  clear2FAState: vi.fn(),
  is2FAVerified: vi.fn(() => false),
  mark2FAVerified: vi.fn(),
}));

vi.mock("@/tenant/components/AuthLayout", () => ({
  default: ({
    title,
    subtitle,
    children,
    footer,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      <h2>{subtitle}</h2>
      {children}
      <footer data-testid="auth-footer">{footer}</footer>
    </div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth.signInTitle": "Welcome Back",
        "auth.signInSubtitle": "Sign in to your workspace",
        "auth.emailAddress": "Email Address",
        "auth.emailPlaceholder": "you@madrasa.app",
        "auth.emailRequired": "Email is required",
        "auth.emailInvalid": "Enter a valid email address",
        "auth.password": "Password",
        "auth.passwordPlaceholder": "••••••••",
        "auth.passwordRequired": "Password is required",
        "auth.rememberMe": "Remember My Email",
        "auth.forgotPassword": "Forgot password?",
        "auth.activateAccount": "Activate account",
        "auth.notYourMadrasa": "Not your madrasa?",
        "auth.viewAllMadrasaLinks": "View all madrasas",
        "auth.signIn": "Sign In",
        "auth.signingIn": "Signing in…",
        "auth.invalidCredentials": "Invalid credentials",
        "auth.emailNotVerified": "Please verify your email before signing in",
        "entry.productName": "MMS",
        "entry.meta.tenantSignIn": "Sign in to your madrasa",
        "account.passwordChanged": "Password changed successfully",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("Login Page", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockExchangeHandoff.mockReset();
    mockIsAuthenticated = false;
    mockUser = null;
    mockRequiresTwoFactor = false;
    localStorage.clear();
  });

  const render = async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Login />);
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

  it("renders sign-in form with all necessary fields and links", async () => {
    await render();

    expect(container.querySelector("h1")?.textContent).toBe("Welcome Back");
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeTruthy();
    expect(container.textContent).toContain("Remember My Email");
    expect(container.textContent).toContain("Forgot password?");
    expect(container.textContent).toContain("Activate account");
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Sign In");
  });

  it("prefills remembered email when stored in localStorage", async () => {
    localStorage.setItem(REMEMBER_EMAIL_KEY, "stored@madrasa.org");
    await render();

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    expect(emailInput.value).toBe("stored@madrasa.org");
  });

  it("validates required fields before calling login", async () => {
    await render();
    const form = container.querySelector("form");

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Email is required");
    expect(container.textContent).toContain("Password is required");
  });

  it("validates invalid email format", async () => {
    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "invalid-email");
      changeInput(passwordInput, "secret123");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Enter a valid email address");
  });

  it("submits valid credentials and navigates to target path", async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: "u1", email: "teacher@madrasa.org", role: "teacher" },
      requires2FA: false,
    });

    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "teacher@madrasa.org");
      changeInput(passwordInput, "correct-password");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockLogin).toHaveBeenCalledWith("teacher@madrasa.org", "correct-password");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("redirects to 2FA verification when requires2FA is true", async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: "u1", email: "admin@madrasa.org", role: "admin" },
      requires2FA: true,
      challengeId: "challenge-xyz",
    });

    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "admin@madrasa.org");
      changeInput(passwordInput, "correct-password");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.twoFactor, {
      replace: true,
      state: { from: "/dashboard" },
    });
  });

  it("redirects to force password change when mustChangePassword is true", async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: "u1", email: "new@madrasa.org", role: "teacher", mustChangePassword: true },
      requires2FA: false,
    });

    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "new@madrasa.org");
      changeInput(passwordInput, "temporary-password");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockNavigate).toHaveBeenCalledWith("/force-password-change", { replace: true });
  });

  it("displays localized error on invalid credentials", async () => {
    mockLogin.mockRejectedValueOnce(
      new AuthFailureError({
        type: "invalid_credentials",
        message: "Invalid email or password",
      }),
    );

    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "user@madrasa.org");
      changeInput(passwordInput, "wrong-password");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Invalid credentials");
  });

  it("displays localized error when email is not verified", async () => {
    mockLogin.mockRejectedValueOnce(
      new AuthFailureError({
        type: "email_not_verified",
        message: "Verify your email before signing in",
      }),
    );

    await render();
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector("form");

    await act(async () => {
      changeInput(emailInput, "unverified@madrasa.org");
      changeInput(passwordInput, "password123");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Please verify your email before signing in");
  });
});
