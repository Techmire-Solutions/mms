import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS, type BrandingSettings } from "@mms/shared";
import { InstitutionSetupFormSections } from "./InstitutionSetupFormSections";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const initialData: BrandingSettings = {
  ...DEFAULT_BRANDING_SETTINGS,
  madrasaName: "Al-Hadi Academy",
  tagline: "Excellence in Islamic Education",
  email: "admin@alhadi.edu",
  phone: "+1-555-0199",
  website: "https://alhadi.edu",
  addressLine1: "123 Peace Way",
  addressLine2: "Suite 4B",
  city: "Chicago",
  region: "IL",
  country: "USA",
  postalCode: "60601",
};

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("InstitutionSetupFormSections", () => {
  it("renders all form section cards and fields with provided values", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <InstitutionSetupFormSections data={initialData} errors={{}} updateField={updateField} />,
      );
    });

    const madrasaInput = container.querySelector("#setup-madrasaName") as HTMLInputElement;
    expect(madrasaInput).not.toBeNull();
    expect(madrasaInput.value).toBe("Al-Hadi Academy");

    const emailInput = container.querySelector("#setup-email") as HTMLInputElement;
    expect(emailInput.value).toBe("admin@alhadi.edu");

    const cityInput = container.querySelector("#setup-city") as HTMLInputElement;
    expect(cityInput.value).toBe("Chicago");
  });

  it("triggers updateField callback when input values change", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <InstitutionSetupFormSections data={initialData} errors={{}} updateField={updateField} />,
      );
    });

    const madrasaInput = container.querySelector("#setup-madrasaName") as HTMLInputElement;
    act(() => {
      changeInput(madrasaInput, "Updated Madrasa");
    });

    expect(updateField).toHaveBeenCalledWith("madrasaName", "Updated Madrasa");
  });

  it("renders error messages when validation errors are present", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    const errors = {
      madrasaName: "Name is required",
      email: "Invalid email address",
      phone: "Phone is required",
      addressLine1: "Address line 1 is required",
      city: "City is required",
      country: "Country is required",
      postalCode: "Postal code is required",
      tagline: "Tagline is required",
    };

    act(() => {
      root.render(
        <InstitutionSetupFormSections
          data={initialData}
          errors={errors}
          updateField={updateField}
        />,
      );
    });

    expect(container.textContent).toContain("Name is required");
    expect(container.textContent).toContain("Invalid email address");
    expect(container.textContent).toContain("Phone is required");
    expect(container.textContent).toContain("Address line 1 is required");
    expect(container.textContent).toContain("City is required");
    expect(container.textContent).toContain("Country is required");
    expect(container.textContent).toContain("Postal code is required");
    expect(container.textContent).toContain("Tagline is required");
  });
});
