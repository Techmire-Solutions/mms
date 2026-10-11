import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContactAddressEntryCard } from "./ContactAddressEntryCard";
import type { Address } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactAddressEntryCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockAddress: Address = {
    line1: "123 Main Street",
    city: "Karachi",
    state: "Sindh",
    country: "Pakistan",
    label: "home",
    isPrimary: true,
  };

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

  it("renders address fields with correct initial values", async () => {
    await act(async () => {
      root.render(
        <ContactAddressEntryCard
          addr={mockAddress}
          idx={0}
          localId="loc-addr-1"
          formInstanceId="inst-1"
          showLabel={true}
          showLine1={true}
          showCity={true}
          showState={true}
          showCountry={true}
          addressLabels={["home", "work"]}
          onUpdateAddressLabels={vi.fn()}
          countryOptions={["Pakistan", "United Kingdom"]}
          onUpdateCountryOptions={vi.fn()}
          defaultCountry="Pakistan"
          isFieldRequired={() => false}
          getListItemError={() => undefined}
          hasMultipleAddresses={false}
          isOnlyAddressOrPrimary={true}
          onSetPrimary={vi.fn()}
          onUpdateAddress={vi.fn()}
          onRemoveAddress={vi.fn()}
        />,
      );
    });

    const streetInput = container.querySelector<HTMLInputElement>(
      "input[name='cf-inst-1-address-line1-0']",
    );
    expect(streetInput?.value).toBe("123 Main Street");

    const cityInput = container.querySelector<HTMLInputElement>(
      "input[name='cf-inst-1-address-city-0']",
    );
    expect(cityInput?.value).toBe("Karachi");

    const stateInput = container.querySelector<HTMLInputElement>(
      "input[name='cf-inst-1-address-state-0']",
    );
    expect(stateInput?.value).toBe("Sindh");
  });

  function changeInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("dispatches onUpdateAddress when street address is edited", async () => {
    const onUpdateAddress = vi.fn();

    await act(async () => {
      root.render(
        <ContactAddressEntryCard
          addr={mockAddress}
          idx={0}
          localId="loc-addr-1"
          formInstanceId="inst-1"
          showLabel={true}
          showLine1={true}
          showCity={true}
          showState={true}
          showCountry={true}
          addressLabels={["home", "work"]}
          onUpdateAddressLabels={vi.fn()}
          countryOptions={["Pakistan", "United Kingdom"]}
          onUpdateCountryOptions={vi.fn()}
          defaultCountry="Pakistan"
          isFieldRequired={() => false}
          getListItemError={() => undefined}
          hasMultipleAddresses={false}
          isOnlyAddressOrPrimary={true}
          onSetPrimary={vi.fn()}
          onUpdateAddress={onUpdateAddress}
          onRemoveAddress={vi.fn()}
        />,
      );
    });

    const streetInput = container.querySelector<HTMLInputElement>(
      "input[name='cf-inst-1-address-line1-0']",
    );
    expect(streetInput).toBeDefined();

    await act(async () => {
      if (streetInput) {
        changeInput(streetInput, "456 Second Avenue");
      }
    });

    expect(onUpdateAddress).toHaveBeenCalledWith({ line1: "456 Second Avenue" });
  });

  it("renders primary address badge and calls onSetPrimary when clicked", async () => {
    const onSetPrimary = vi.fn();

    await act(async () => {
      root.render(
        <ContactAddressEntryCard
          addr={{ ...mockAddress, isPrimary: false }}
          idx={1}
          localId="loc-addr-2"
          formInstanceId="inst-1"
          showLabel={true}
          showLine1={true}
          showCity={true}
          showState={true}
          showCountry={true}
          addressLabels={["home", "work"]}
          onUpdateAddressLabels={vi.fn()}
          countryOptions={["Pakistan", "United Kingdom"]}
          onUpdateCountryOptions={vi.fn()}
          defaultCountry="Pakistan"
          isFieldRequired={() => false}
          getListItemError={() => undefined}
          hasMultipleAddresses={true}
          isOnlyAddressOrPrimary={false}
          onSetPrimary={onSetPrimary}
          onUpdateAddress={vi.fn()}
          onRemoveAddress={vi.fn()}
        />,
      );
    });

    const primaryBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("contacts.form.setPrimary"),
    );
    expect(primaryBtn).toBeDefined();

    await act(async () => {
      primaryBtn?.click();
    });

    expect(onSetPrimary).toHaveBeenCalled();
  });
});
