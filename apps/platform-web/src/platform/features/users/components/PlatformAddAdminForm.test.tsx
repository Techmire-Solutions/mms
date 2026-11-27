import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAddAdminForm } from "./PlatformAddAdminForm";

const mutateAsyncMock = vi.fn();

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/platform/features/users/hooks/usePlatformAdmins", () => ({
  useAddPlatformAdmin: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@/platform/features/auth/lib/platformAuthErrors", () => ({
  getPlatformErrorMessage: (err: Error) => err.message,
}));

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("PlatformAddAdminForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/users");
  });

  it("opens automatically from ?create=true, validates fields, submits normalized admin, and cleans query param on close", async () => {
    window.history.replaceState({}, "", "/users?create=true");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PlatformAddAdminForm />);
    });

    const submitForm = async () => {
      const form = document.body.querySelector("#platform-add-admin-form") as HTMLFormElement;
      await act(async () => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    };

    await submitForm();
    expect(mutateAsyncMock).not.toHaveBeenCalled();

    const nameInput = document.body.querySelector("#admin-name") as HTMLInputElement;
    const emailInput = document.body.querySelector("#admin-email") as HTMLInputElement;
    const passwordInput = document.body.querySelector("#admin-password") as HTMLInputElement;
    const operatorPasswordInput = document.body.querySelector(
      "#admin-operator-password",
    ) as HTMLInputElement;

    await act(async () => {
      changeInput(nameInput, "  Zayd Ali  ");
      changeInput(emailInput, "ZAYD@EXAMPLE.COM");
      changeInput(passwordInput, "StrongAdminPass123!");
    });

    await submitForm();
    expect(document.body.textContent).toContain("platform.validationConfirmPlatformPassword");

    mutateAsyncMock.mockRejectedValueOnce(new Error("Email already exists"));
    await act(async () => {
      changeInput(operatorPasswordInput, "MyOperatorSecret123!");
    });
    await submitForm();
    expect(document.body.textContent).toContain("Email already exists");

    mutateAsyncMock.mockResolvedValueOnce({});
    await submitForm();
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Zayd Ali",
        email: "zayd@example.com",
        password: "StrongAdminPass123!",
        currentPassword: "MyOperatorSecret123!",
      }),
    );
    expect(window.location.search).toBe("");

    act(() => root.unmount());
    container.remove();
  });

  it("renders trigger-only mode and opens modal on click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PlatformAddAdminForm asTriggerOnly />);
    });

    const triggerBtn = container.querySelector("button") as HTMLButtonElement;
    expect(triggerBtn.textContent).toContain("platform.addAdmin");

    await act(async () => {
      triggerBtn.click();
    });
    expect(document.body.querySelector("#platform-add-admin-form")).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
