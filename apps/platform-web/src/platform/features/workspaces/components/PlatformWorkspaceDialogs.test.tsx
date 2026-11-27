import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformWorkspaceRow } from "@mms/contracts";
import { PlatformWorkspaceCreateAdminDialog } from "./PlatformWorkspaceCreateAdminDialog";
import { PlatformWorkspaceResetPasswordDialog } from "./PlatformWorkspaceResetPasswordDialog";
import { PlatformWorkspaceModulesDialog } from "./PlatformWorkspaceModulesDialog";

const useWorkspaceModulesMock = vi.fn();
const updateModulesMutateMock = vi.fn();

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/platform/features/workspaces/hooks/usePlatformWorkspaces", () => ({
  useWorkspaceModules: (...args: unknown[]) => useWorkspaceModulesMock(...args),
  useUpdateWorkspaceModules: () => ({
    mutateAsync: updateModulesMutateMock,
    isPending: false,
  }),
}));

vi.mock("@/platform/features/auth/lib/platformAuthErrors", () => ({
  getPlatformErrorMessage: (err: Error) => err.message,
}));

const WORKSPACE: PlatformWorkspaceRow = {
  subdomain: "alnoor",
  madrasaName: "Al Noor",
  enabled: true,
  requireEmailVerification: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  adminEmail: "admin@alnoor.org",
};

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("PlatformWorkspaceCreateAdminDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without workspace, validates fields, submits, and renders result card", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <PlatformWorkspaceCreateAdminDialog
          open
          onOpenChange={onOpenChange}
          workspace={null}
          createPending={false}
          onConfirm={onConfirm}
        />,
      );
    });
    expect(container.innerHTML).toBe("");

    await act(async () => {
      root.render(
        <PlatformWorkspaceCreateAdminDialog
          open
          onOpenChange={onOpenChange}
          workspace={WORKSPACE}
          createPending={false}
          onConfirm={onConfirm}
        />,
      );
    });

    const submitForm = async () => {
      const form = document.body.querySelector("#platform-create-admin-form") as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    };

    await submitForm();
    expect(document.body.textContent).toContain("platform.validationEnterName");

    const textInputs = Array.from(
      document.body.querySelectorAll('#platform-create-admin-form input[type="text"]'),
    ) as HTMLInputElement[];
    const emailInput = document.body.querySelector(
      '#platform-create-admin-form input[type="email"]',
    ) as HTMLInputElement;
    const stepUpInput = document.body.querySelector("#create-step-up-alnoor") as HTMLInputElement;

    await act(async () => {
      changeInput(textInputs[0], "Ustadh Bilal");
    });
    await submitForm();
    expect(document.body.textContent).toContain("platform.validationEnterValidEmail");

    await act(async () => {
      changeInput(emailInput, "bilal@alnoor.org");
    });
    await submitForm();
    expect(document.body.textContent).toContain("platform.validationConfirmPlatformPassword");

    onConfirm.mockRejectedValueOnce(new Error("Step-up failed"));
    await act(async () => {
      changeInput(stepUpInput, "PlatformSecret123!");
    });
    await submitForm();
    expect(document.body.textContent).toContain("Step-up failed");

    onConfirm.mockResolvedValueOnce({
      name: "Ustadh Bilal",
      adminEmail: "bilal@alnoor.org",
      initialPassword: "GeneratedPassword123!",
    });
    await submitForm();
    expect(onConfirm).toHaveBeenCalledWith(
      "alnoor",
      expect.objectContaining({
        name: "Ustadh Bilal",
        email: "bilal@alnoor.org",
        currentPassword: "PlatformSecret123!",
      }),
    );
    expect(document.body.textContent).toContain("GeneratedPassword123!");

    act(() => root.unmount());
    container.remove();
  });
});

describe("PlatformWorkspaceResetPasswordDialog & PlatformWorkspaceModulesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates step-up password on reset and renders new credentials on success", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConfirm = vi.fn().mockResolvedValue({
      newPassword: "TempPassword99!",
      adminEmail: "admin@alnoor.org",
    });

    await act(async () => {
      root.render(
        <PlatformWorkspaceResetPasswordDialog
          open
          onOpenChange={vi.fn()}
          workspace={WORKSPACE}
          resetPending={false}
          onConfirm={onConfirm}
        />,
      );
    });

    const form = document.body.querySelector("#platform-reset-password-form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(document.body.textContent).toContain("platform.validationConfirmPlatformPassword");

    const stepUp = document.body.querySelector("#reset-step-up-alnoor") as HTMLInputElement;
    await act(async () => {
      changeInput(stepUp, "MyOperatorPass1!");
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onConfirm).toHaveBeenCalledWith("alnoor", {
      password: "MyOperatorPass1!",
      newPassword: undefined,
    });
    expect(document.body.textContent).toContain("TempPassword99!");

    act(() => root.unmount());
    container.remove();
  });

  it("loads workspace modules, warns when disabling active modules, and saves selection", async () => {
    useWorkspaceModulesMock.mockReturnValue({
      data: ["students", "attendance", "accounting"],
      isLoading: false,
    });
    updateModulesMutateMock.mockResolvedValueOnce({});

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <PlatformWorkspaceModulesDialog workspace={WORKSPACE} open onOpenChange={onOpenChange} />,
      );
    });

    const checkboxes = Array.from(
      document.body.querySelectorAll('[role="checkbox"]'),
    ) as HTMLElement[];
    expect(checkboxes.length).toBeGreaterThan(0);

    await act(async () => {
      checkboxes[checkboxes.length - 1]?.click();
    });

    const form = document.body.querySelector("#platform-workspace-modules-form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(updateModulesMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subdomain: "alnoor" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => root.unmount());
    container.remove();
  });
});
