import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPermissionMatrix } from "@/platform/features/users/components/PlatformPermissionMatrix";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

vi.mock("@/platform/features/users/hooks/usePlatformPermissionMatrix", async () => {
  const react = await import("react");
  return {
    usePlatformPermissionMatrix: () => {
      const [stepUpPassword, setStepUpPassword] = react.useState("");
      return {
        filteredAdmins: [],
        isLoading: false,
        isError: false,
        retry: vi.fn(),
        isSuperUser: true,
        currentUser: null,
        search: "",
        setSearch: vi.fn(),
        handleToggle: vi.fn(),
        busy: false,
        pendingToggle: {
          admin: {
            id: "adm_2",
            email: "admin2@example.com",
            name: "Second Admin",
            role: "admin" as const,
            permissions: {
              workspaces: false,
              onboard: false,
              settings: false,
              admins: false,
              system: false,
            },
          },
          permissions: {
            workspaces: false,
            onboard: false,
            settings: false,
            admins: false,
            system: false,
          },
        },
        stepUpPassword,
        setStepUpPassword,
        stepUpError: null,
        cancelStepUp: vi.fn(),
        confirmStepUp: vi.fn(),
      };
    },
  };
});

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("PlatformPermissionMatrix dirty guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  it("asks before discarding a typed step-up password", async () => {
    await act(async () => {
      root.render(<PlatformPermissionMatrix />);
    });

    const password = document.body.querySelector("#matrix-step-up") as HTMLInputElement;
    await act(async () => setInputValue(password, "platform-secret"));

    const cancel = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancel",
    );
    await act(async () => cancel?.click());

    expect(document.body.textContent).toContain("Unsaved Changes");
    expect(document.body.textContent).toContain(
      "You have unsaved changes. Discard them and close?",
    );
  });
});
