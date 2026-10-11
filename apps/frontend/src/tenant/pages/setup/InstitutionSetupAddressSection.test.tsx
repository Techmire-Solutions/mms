import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstitutionSetupAddressSection } from "./InstitutionSetupAddressSection";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

const initialData: BrandingSettings = {
  ...DEFAULT_BRANDING_SETTINGS,
  addressLine1: "123 Main St",
  city: "Springfield",
  country: "United States",
};

describe("InstitutionSetupAddressSection", () => {
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

  it("renders all address fields with initial values", async () => {
    await act(async () => {
      root.render(
        <InstitutionSetupAddressSection data={initialData} errors={{}} updateField={vi.fn()} />,
      );
    });

    const addressInput = container.querySelector("#setup-addressLine1") as HTMLInputElement;
    expect(addressInput?.value).toBe("123 Main St");

    const cityInput = container.querySelector("#setup-city") as HTMLInputElement;
    expect(cityInput?.value).toBe("Springfield");

    const countryInput = container.querySelector("#setup-country") as HTMLInputElement;
    expect(countryInput?.value).toBe("United States");
  });

  it("triggers updateField when inputs change", async () => {
    const updateField = vi.fn();

    await act(async () => {
      root.render(
        <InstitutionSetupAddressSection data={initialData} errors={{}} updateField={updateField} />,
      );
    });

    const cityInput = container.querySelector("#setup-city") as HTMLInputElement;

    act(() => {
      changeInput(cityInput, "Boston");
    });

    expect(updateField).toHaveBeenCalledWith("city", "Boston");
  });

  it("displays validation error when field error is present", async () => {
    await act(async () => {
      root.render(
        <InstitutionSetupAddressSection
          data={initialData}
          errors={{
            addressLine1: "Address line 1 is required",
            city: "City is required",
          }}
          updateField={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Address line 1 is required");
    expect(container.textContent).toContain("City is required");
  });
});
