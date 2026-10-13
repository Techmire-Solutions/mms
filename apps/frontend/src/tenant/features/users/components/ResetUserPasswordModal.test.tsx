import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemUser } from "@mms/shared";
import { ResetUserPasswordModal } from "./ResetUserPasswordModal";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.name ? `${key}:${params.name}` : key,
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ passwordPolicy: "strong" }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    title,
    error,
    onSave,
    saveDisabled,
    children,
  }: {
    title: React.ReactNode;
    error?: string;
    onSave?: () => void;
    saveDisabled?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      {error ? <div role="alert">{error}</div> : null}
      {children}
      <button data-testid="save-password" type="button" disabled={saveDisabled} onClick={onSave}>
        save
      </button>
    </div>
  ),
}));

const user: SystemUser = {
  id: "u-1",
  name: "Mujahid User",
  email: "mujahid@dq.com",
  phone: "",
  role: "teacher",
  status: "active",
  twoFactorEnabled: false,
  lastLogin: "",
  createdDate: "2026-01-01",
  failedLoginAttempts: 0,
  activeSessions: 1,
  avatarInitials: "MU",
};

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ResetUserPasswordModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.removeChild(container);
  });

  it("submits a policy-compliant matching temporary password", async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    await act(async () => {
      root.render(<ResetUserPasswordModal user={user} onClose={onClose} onReset={onReset} />);
    });

    const inputs = [...container.querySelectorAll("input")] as HTMLInputElement[];
    await act(async () => {
      changeInput(inputs[0]!, "TemporaryPass1!");
      changeInput(inputs[1]!, "TemporaryPass1!");
    });
    await act(async () => {
      container
        .querySelector('[data-testid="save-password"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReset).toHaveBeenCalledWith("TemporaryPass1!");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched temporary passwords without calling the API", async () => {
    const onReset = vi.fn();
    await act(async () => {
      root.render(<ResetUserPasswordModal user={user} onClose={vi.fn()} onReset={onReset} />);
    });

    const inputs = [...container.querySelectorAll("input")] as HTMLInputElement[];
    await act(async () => {
      changeInput(inputs[0]!, "TemporaryPass1!");
      changeInput(inputs[1]!, "DifferentPass1!");
    });
    await act(async () => {
      container
        .querySelector('[data-testid="save-password"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onReset).not.toHaveBeenCalled();
    expect(container.textContent).toContain("users.resetPasswordMismatch");
  });
});
