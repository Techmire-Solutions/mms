import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ForcePasswordChange from "./ForcePasswordChange";
import { ROUTES } from "@/lib/config/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
const mockChangePassword = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/tenant/components/AuthLayout", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="auth-layout">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    passwordPolicy: "strong",
  }),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    auth: {
      changePassword: (...args: unknown[]) => mockChangePassword(...args),
    },
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "account.forcePasswordTitle": "Force Password Change",
        "account.forcePasswordBody": "You must change your password before continuing.",
        "account.currentPassword": "Current Password",
        "account.newPassword": "New Password",
        "account.confirmPassword": "Confirm Password",
        "account.forcePasswordSubmit": "Change Password",
        "account.passwordMismatch": "New passwords do not match",
        "account.wrongPassword": "Wrong current password",
        "auth.passwordRequired": "Password is required",
        "global.passwordPolicyErrorMin12": "Password must be at least 12 characters.",
        "entry.productName": "MMS",
        "common.loading": "Loading...",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("ForcePasswordChange", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockNavigate.mockReset();
    mockLogout.mockReset();
    mockChangePassword.mockReset();
  });

  const render = async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ForcePasswordChange />);
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

  it("renders all password fields and warning banner", async () => {
    const root = await render();

    expect(container.querySelector("#current-password")).not.toBeNull();
    expect(container.querySelector("#new-password")).not.toBeNull();
    expect(container.querySelector("#confirm-password")).not.toBeNull();
    expect(container.textContent).toContain("You must change your password before continuing.");

    act(() => {
      root.unmount();
    });
  });

  it("validates empty fields on submit", async () => {
    const root = await render();
    const form = container.querySelector("form");

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Password is required");
    expect(mockChangePassword).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("validates password mismatch", async () => {
    const root = await render();
    const currentInput = container.querySelector("#current-password") as HTMLInputElement;
    const newInput = container.querySelector("#new-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#confirm-password") as HTMLInputElement;

    act(() => {
      changeInput(currentInput, "OldPass123!");
      changeInput(newInput, "NewPassword123!@#");
      changeInput(confirmInput, "Different123!@#");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("New passwords do not match");
    expect(mockChangePassword).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("validates password policy compliance", async () => {
    const root = await render();
    const currentInput = container.querySelector("#current-password") as HTMLInputElement;
    const newInput = container.querySelector("#new-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#confirm-password") as HTMLInputElement;

    act(() => {
      changeInput(currentInput, "OldPass123!");
      changeInput(newInput, "Short1!");
      changeInput(confirmInput, "Short1!");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Password must be at least 12 characters.");
    expect(mockChangePassword).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("submits valid password and navigates to login with state", async () => {
    mockChangePassword.mockResolvedValueOnce({
      status: 200,
      body: { success: true },
    });

    const root = await render();
    const currentInput = container.querySelector("#current-password") as HTMLInputElement;
    const newInput = container.querySelector("#new-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#confirm-password") as HTMLInputElement;

    act(() => {
      changeInput(currentInput, "OldPassword123!");
      changeInput(newInput, "StrongPassword123!@#");
      changeInput(confirmInput, "StrongPassword123!@#");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mockChangePassword).toHaveBeenCalledWith({
      body: {
        currentPassword: "OldPassword123!",
        newPassword: "StrongPassword123!@#",
      },
    });
    expect(mockLogout).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.login, {
      replace: true,
      state: { passwordChanged: true },
    });

    act(() => {
      root.unmount();
    });
  });

  it("displays error banner when changePassword returns non-200", async () => {
    mockChangePassword.mockResolvedValueOnce({
      status: 400,
      body: { message: "Current password is incorrect" },
    });

    const root = await render();
    const currentInput = container.querySelector("#current-password") as HTMLInputElement;
    const newInput = container.querySelector("#new-password") as HTMLInputElement;
    const confirmInput = container.querySelector("#confirm-password") as HTMLInputElement;

    act(() => {
      changeInput(currentInput, "WrongOldPassword123!");
      changeInput(newInput, "StrongPassword123!@#");
      changeInput(confirmInput, "StrongPassword123!@#");
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("Current password is incorrect");
    expect(mockLogout).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
