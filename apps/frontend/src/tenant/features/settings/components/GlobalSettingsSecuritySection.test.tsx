import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from "@mms/shared";
import { GlobalSettingsSecuritySection } from "./GlobalSettingsSecuritySection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("GlobalSettingsSecuritySection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders sessionTimeout and passwordPolicy with correct IDs, names, and label associations", async () => {
    const upd = vi.fn();
    const mockData: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      sessionTimeout: "30",
      passwordPolicy: "medium",
      twoFactor: false,
    };

    await act(async () => {
      root.render(<GlobalSettingsSecuritySection data={mockData} upd={upd} />);
    });

    const sessionSelect = container.querySelector<HTMLSelectElement>("select#sessionTimeout");
    expect(sessionSelect).not.toBeNull();
    expect(sessionSelect?.name).toBe("sessionTimeout");
    expect(sessionSelect?.value).toBe("30");

    const sessionLabel = container.querySelector<HTMLLabelElement>('label[for="sessionTimeout"]');
    expect(sessionLabel).not.toBeNull();
    expect(sessionLabel?.textContent).toBe("global.sessionTimeout");

    const policySelect = container.querySelector<HTMLSelectElement>("select#passwordPolicy");
    expect(policySelect).not.toBeNull();
    expect(policySelect?.name).toBe("passwordPolicy");
    expect(policySelect?.value).toBe("medium");

    const policyLabel = container.querySelector<HTMLLabelElement>('label[for="passwordPolicy"]');
    expect(policyLabel).not.toBeNull();
    expect(policyLabel?.textContent).toBe("global.passwordPolicy");
  });

  it("triggers upd when sessionTimeout or passwordPolicy selection changes", async () => {
    const upd = vi.fn();
    const mockData: GlobalSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      sessionTimeout: "30",
      passwordPolicy: "medium",
      twoFactor: false,
    };

    await act(async () => {
      root.render(<GlobalSettingsSecuritySection data={mockData} upd={upd} />);
    });

    const sessionSelect = container.querySelector<HTMLSelectElement>("select#sessionTimeout");
    expect(sessionSelect).not.toBeNull();

    await act(async () => {
      if (sessionSelect) {
        sessionSelect.value = "120";
        sessionSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(upd).toHaveBeenCalledWith("sessionTimeout", "120");

    const policySelect = container.querySelector<HTMLSelectElement>("select#passwordPolicy");
    expect(policySelect).not.toBeNull();

    await act(async () => {
      if (policySelect) {
        policySelect.value = "strong";
        policySelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(upd).toHaveBeenCalledWith("passwordPolicy", "strong");
  });
});
