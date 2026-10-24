import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModuleColumnCustomizer } from "./ModuleColumnCustomizer";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "./moduleColumnCustomizerTypes";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLabels: ModuleColumnCustomizerLabels = {
  trigger: "Customize Columns",
  title: "Columns Layout",
  visibleAndOrder: "Visible & Order",
  hidden: "Hidden Columns",
  fixed: "Fixed",
  hideColumn: (label: string) => `Hide ${label} column`,
  reset: "Reset layout",
  searchPlaceholder: "Search columns...",
};

const mockColumns: ModuleColumnRegistryEntry[] = [
  { key: "name", label: "Full Name", enabled: true, order: 0, fixed: true },
  { key: "phone", label: "Phone Number", enabled: true, order: 1 },
  { key: "email", label: "Email Address", enabled: false, order: 2 },
];

const mockManyColumns: ModuleColumnRegistryEntry[] = [
  { key: "name", label: "Full Name", enabled: true, order: 0, fixed: true },
  { key: "phone", label: "Phone Number", enabled: true, order: 1 },
  { key: "email", label: "Email Address", enabled: true, order: 2 },
  { key: "gender", label: "Gender", enabled: true, order: 3 },
  { key: "city", label: "City", enabled: true, order: 4 },
  { key: "country", label: "Country", enabled: true, order: 5 },
  { key: "role", label: "Role", enabled: false, order: 6 },
];

describe("ModuleColumnCustomizer Component", () => {
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
    document.body.removeChild(container);
  });

  it("renders trigger button with labels.trigger in idle state", () => {
    const html = renderToStaticMarkup(
      <ModuleColumnCustomizer
        columnRegistry={mockColumns}
        updateUserColumnLayout={vi.fn()}
        labels={mockLabels}
      />,
    );

    expect(html).toContain("Customize Columns");
  });

  it("renders disabled state and custom className on trigger when provided", () => {
    const html = renderToStaticMarkup(
      <ModuleColumnCustomizer
        columnRegistry={mockColumns}
        updateUserColumnLayout={vi.fn()}
        labels={mockLabels}
        disabled={true}
        className="custom-customizer-trigger"
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("custom-customizer-trigger");
  });

  it("opens popover, lists visible/hidden columns, and handles toggling and reset", async () => {
    const updateUserColumnLayout = vi.fn();
    const onResetLayout = vi.fn();

    await act(async () => {
      root.render(
        <ModuleColumnCustomizer
          columnRegistry={mockColumns}
          updateUserColumnLayout={updateUserColumnLayout}
          onResetLayout={onResetLayout}
          labels={mockLabels}
        />,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain("Columns Layout");
    expect(bodyHtml).toContain("Full Name");
    expect(bodyHtml).toContain("Phone Number");
    expect(bodyHtml).toContain("Email Address");
    expect(bodyHtml).toContain("Fixed");

    // Click Reset
    const resetButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Reset layout"),
    );
    expect(resetButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onResetLayout).toHaveBeenCalledTimes(1);

    // Toggle hidden email column to enabled
    const emailToggleButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Email Address"),
    );
    expect(emailToggleButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      emailToggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(updateUserColumnLayout).toHaveBeenCalled();
    const lastCall = updateUserColumnLayout.mock.calls[0]?.[0] as ModuleColumnRegistryEntry[];
    const emailCol = lastCall.find((col) => col.key === "email");
    expect(emailCol?.enabled).toBe(true);

    // Toggle visible phone column to hidden via eye button
    const hidePhoneButton = document.querySelector('button[aria-label="Hide Phone Number column"]');
    expect(hidePhoneButton).not.toBeNull();

    await act(async () => {
      hidePhoneButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const secondCall = updateUserColumnLayout.mock.calls[1]?.[0] as ModuleColumnRegistryEntry[];
    const phoneCol = secondCall.find((col) => col.key === "phone");
    expect(phoneCol?.enabled).toBe(false);
  });

  it("renders search filter input when total columns > 6 and filters column list", async () => {
    await act(async () => {
      root.render(
        <ModuleColumnCustomizer
          columnRegistry={mockManyColumns}
          updateUserColumnLayout={vi.fn()}
          labels={mockLabels}
        />,
      );
    });

    const trigger = container.querySelector("button");
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    expect(searchInput?.getAttribute("placeholder")).toBe("Search columns...");

    await act(async () => {
      if (searchInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeInputValueSetter?.call(searchInput, "city");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(document.body.innerHTML).toContain("City");
  });

  it("automatically resolves default localized labels when labels prop is omitted", () => {
    const html = renderToStaticMarkup(
      <ModuleColumnCustomizer columnRegistry={mockColumns} updateUserColumnLayout={vi.fn()} />,
    );

    expect(html).toContain("common.columns.trigger");
  });

  it("renders customized columns count badge when columns are hidden", () => {
    const html = renderToStaticMarkup(
      <ModuleColumnCustomizer
        columnRegistry={mockColumns} // has 1 disabled email column
        updateUserColumnLayout={vi.fn()}
      />,
    );

    expect(html).toContain("2/3");
  });
});
