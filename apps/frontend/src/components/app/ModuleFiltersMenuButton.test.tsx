import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ModuleFiltersMenuTrigger,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
  ModuleFilterCheckboxGroup,
  ModuleFilterDivider,
} from "./ModuleFiltersMenuButton";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ModuleFiltersMenuButton Primitives", () => {
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

  it("renders trigger in idle state when activeCount is 0 without badge", () => {
    const html = renderToStaticMarkup(<ModuleFiltersMenuTrigger label="Filters" activeCount={0} />);
    expect(html).toContain("Filters");
    expect(html).not.toContain("font-bold");
  });

  it("renders trigger in active state with theme-aligned badge when activeCount > 0", () => {
    const html = renderToStaticMarkup(<ModuleFiltersMenuTrigger label="Filters" activeCount={5} />);
    expect(html).toContain("Filters");
    expect(html).toContain(">5<");
    expect(html).toContain("font-bold");
    // Ensure hardcoded rounded-full pill is not present
    expect(html).not.toContain("rounded-full");
  });

  it("renders ModuleFilterDropdown, opens content, and invokes onClear action", async () => {
    const onClear = vi.fn();
    const onValueChange = vi.fn();
    const onToggle = vi.fn();

    await act(async () => {
      root.render(
        <ModuleFilterDropdown
          label="Filters"
          activeCount={2}
          clearLabel="Reset all filters"
          onClear={onClear}
        >
          <ModuleFilterRadioGroup
            label="View Preset"
            value="active"
            onValueChange={onValueChange}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
            ]}
          />
          <ModuleFilterDivider />
          <ModuleFilterCheckboxGroup
            label="Tags"
            selected={["vip"]}
            onToggle={onToggle}
            options={[
              { value: "vip", label: "VIP" },
              { value: "lead", label: "Lead" },
            ]}
          />
        </ModuleFilterDropdown>,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      trigger?.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    });

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain("Reset all filters");
    expect(bodyHtml).toContain("View Preset");
    expect(bodyHtml).toContain("Tags");
    expect(bodyHtml).toContain("VIP");

    const clearItem = document.querySelector('[role="menuitem"]');
    expect(clearItem).not.toBeNull();

    await act(async () => {
      clearItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClear).toHaveBeenCalled();
  });
});
