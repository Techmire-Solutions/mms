import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Step3 } from "./AddUserModalStep3";
import type { AddUserFormState } from "./addUserModalTypes";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    passwordPolicy: "strong",
  }),
}));

describe("AddUserModalStep3", () => {
  const baseForm: AddUserFormState = {
    contactId: null,
    name: "New User",
    email: "newuser@example.com",
    phone: "",
    role: "teacher",
    status: "active",
    temporaryRole: false,
    roleExpiry: "",
    setupMethod: "invite",
    password: "",
    forceReset: true,
    twoFactorEnabled: false,
  };

  it("renders invite method view by default and switches to password method", () => {
    let currentForm = { ...baseForm };
    const setForm = vi.fn((updater) => {
      currentForm = typeof updater === "function" ? updater(currentForm) : updater;
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Step3 form={currentForm} setForm={setForm} errors={{}} />);
    });

    expect(container.textContent).toContain("users.addInviteTitle");
    expect(container.textContent).toContain("users.addInviteBody");

    // Click password option button
    const buttons = container.querySelectorAll('button[type="button"]');
    const passwordOptionBtn = Array.from(buttons).find((b) =>
      b.textContent?.includes("users.addMethodPassword"),
    );
    expect(passwordOptionBtn).toBeDefined();

    act(() => {
      passwordOptionBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(setForm).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("renders password input, visibility toggle with aria-label, and force reset when password method is selected", () => {
    const currentForm: AddUserFormState = {
      ...baseForm,
      setupMethod: "password",
      password: "InitialPassword123!",
    };
    const setForm = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Step3 form={currentForm} setForm={setForm} errors={{}} />);
    });

    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("InitialPassword123!");

    const toggleBtn = container.querySelector('button[aria-label="auth.showPassword"]');
    expect(toggleBtn).not.toBeNull();

    // Click reveal toggle
    act(() => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="auth.hidePassword"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("toggles two-factor authentication checkbox", () => {
    let currentForm: AddUserFormState = {
      ...baseForm,
      twoFactorEnabled: false,
    };
    const setForm = vi.fn((updater) => {
      currentForm = typeof updater === "function" ? updater(currentForm) : updater;
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Step3 form={currentForm} setForm={setForm} errors={{}} />);
    });

    const checkboxes = container.querySelectorAll('button[role="checkbox"]');
    const twoFactorCheckbox = checkboxes[checkboxes.length - 1];

    act(() => {
      twoFactorCheckbox?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(setForm).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
