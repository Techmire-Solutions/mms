import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformProfileNameForm } from "./PlatformProfileNameForm";
import { PlatformProfilePasswordForm } from "./PlatformProfilePasswordForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockMutateNameAsync = vi.fn().mockResolvedValue(undefined);
const mockMutatePasswordAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    platformUser: { id: "p1", name: "Super Admin", email: "admin@example.com" },
  }),
}));

vi.mock("@/platform/hooks/usePlatformProfile", () => ({
  useUpdatePlatformProfileName: () => ({
    mutateAsync: mockMutateNameAsync,
    isPending: false,
  }),
  useUpdatePlatformPassword: () => ({
    mutateAsync: mockMutatePasswordAsync,
    isPending: false,
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

describe("PlatformProfileForms", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders PlatformProfileNameForm with correct ID, name, and label association", async () => {
    await act(async () => {
      root.render(<PlatformProfileNameForm initialName="Admin User" />);
    });

    const input = container.querySelector<HTMLInputElement>("input#platform-profile-name");
    expect(input).not.toBeNull();
    expect(input?.name).toBe("name");
    expect(input?.value).toBe("Admin User");

    const label = container.querySelector<HTMLLabelElement>('label[for="platform-profile-name"]');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain("platform.profileName");
  });

  it("renders PlatformProfilePasswordForm with current, new, and confirm password inputs", async () => {
    await act(async () => {
      root.render(<PlatformProfilePasswordForm />);
    });

    const currentInput = container.querySelector<HTMLInputElement>(
      "input#platform-current-password",
    );
    expect(currentInput).not.toBeNull();
    expect(currentInput?.name).toBe("currentPassword");

    const newInput = container.querySelector<HTMLInputElement>("input#platform-new-password");
    expect(newInput).not.toBeNull();
    expect(newInput?.name).toBe("newPassword");

    const confirmInput = container.querySelector<HTMLInputElement>(
      "input#platform-confirm-new-password",
    );
    expect(confirmInput).not.toBeNull();
    expect(confirmInput?.name).toBe("confirmPassword");
  });
});
