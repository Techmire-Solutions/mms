import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnboardingData } from "@/platform/pages/onboarding/onboardingWizardTypes";
import { ONBOARDING_INITIAL_DATA } from "@/platform/pages/onboarding/onboardingWizardTypes";
import AdminSetup from "./AdminSetup";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/entry", () => ({
  AuthEmailField: (props: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label htmlFor={props.id}>
      {props.label}
      <input id={props.id} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  ),
  AuthPasswordField: (props: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    describedBy?: string;
  }) => (
    <label htmlFor={props.id}>
      {props.label}
      <input
        id={props.id}
        type="password"
        value={props.value}
        aria-describedby={props.describedBy}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  ),
}));

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

function renderStep(data: OnboardingData, onChange: (updater: unknown) => void): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<AdminSetup data={data} onChange={onChange as never} />);
  });
  return container;
}

describe("AdminSetup (platform onboarding step)", () => {
  it("does not ask the platform operator to accept terms of service", () => {
    const el = renderStep({ ...ONBOARDING_INITIAL_DATA }, vi.fn());
    expect(el.querySelector("#terms")).toBeNull();
    expect(el.textContent).not.toContain("onboarding.agreeTerms");
  });

  it("collects the administrator gender with the tenant contact lookup values", () => {
    const onChange = vi.fn();
    const el = renderStep({ ...ONBOARDING_INITIAL_DATA }, onChange);

    const gender = el.querySelector<HTMLSelectElement>("#gender");
    expect(gender).not.toBeNull();
    const values = Array.from(gender!.querySelectorAll("option")).map((o) => o.value);
    expect(values).toEqual(["", "male", "female"]);

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(gender, "female");
      gender!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0]![0] as (prev: OnboardingData) => OnboardingData;
    expect(updater({ ...ONBOARDING_INITIAL_DATA }).adminGender).toBe("female");
  });

  it("defaults to the activation-email mode and hides the password inputs", () => {
    const el = renderStep({ ...ONBOARDING_INITIAL_DATA }, vi.fn());
    expect(el.querySelector("#admin-password")).toBeNull();
    expect(el.querySelector("#admin-password-confirm")).toBeNull();
    expect(el.textContent).toContain("onboarding.admin.passwordEmailNotice");
  });

  it("switches to temporary-password mode and collects password + confirmation", () => {
    const onChange = vi.fn();
    const el = renderStep({ ...ONBOARDING_INITIAL_DATA }, onChange);

    const temporaryButton = Array.from(el.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("onboarding.admin.passwordModeTemporary"),
    );
    expect(temporaryButton).toBeDefined();
    act(() => {
      temporaryButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const updater = onChange.mock.calls[0]![0] as (prev: OnboardingData) => OnboardingData;
    expect(updater({ ...ONBOARDING_INITIAL_DATA }).adminPasswordMode).toBe("temporary");
  });
});
