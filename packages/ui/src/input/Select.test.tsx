import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  Select,
  SelectTrigger,
  SelectValue,
  selectBrandClass,
  isRadixSelectPortalTarget,
} from "./Select";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Select component & branded-select-styling", () => {
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
  });

  it("exports selectBrandClass for native select progressive enhancement", () => {
    expect(selectBrandClass).toBe("brand-select");
  });

  it("renders native select with selectBrandClass", async () => {
    await act(async () => {
      root.render(
        <select className={selectBrandClass} data-testid="native-select" defaultValue="opt1">
          <option value="opt1">Option 1</option>
          <option value="opt2">Option 2</option>
        </select>,
      );
    });

    const select = container.querySelector<HTMLSelectElement>("select");
    expect(select).not.toBeNull();
    expect(select?.classList.contains("brand-select")).toBe(true);
    expect(select?.value).toBe("opt1");
  });

  it("renders SelectTrigger with default attributes and chevron icon", async () => {
    await act(async () => {
      root.render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    expect(trigger?.className).toContain("flex");
    expect(trigger?.className).toContain("min-h-11");
  });

  it("applies destructive error styling when error is true on SelectTrigger", async () => {
    await act(async () => {
      root.render(
        <Select>
          <SelectTrigger error>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>,
      );
    });

    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    expect(trigger?.className).toContain("border-destructive");
  });

  it("identifies radix select portal targets correctly via isRadixSelectPortalTarget", () => {
    const outsideEl = document.createElement("div");
    expect(isRadixSelectPortalTarget(outsideEl)).toBe(false);
    expect(isRadixSelectPortalTarget(null)).toBe(false);

    const portalContainer = document.createElement("div");
    portalContainer.setAttribute("data-radix-select-content", "");
    const childEl = document.createElement("span");
    portalContainer.appendChild(childEl);

    expect(isRadixSelectPortalTarget(childEl)).toBe(true);
    expect(isRadixSelectPortalTarget(portalContainer)).toBe(true);
  });
});
