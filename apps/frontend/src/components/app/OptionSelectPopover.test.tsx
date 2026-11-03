import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OptionSelectPopover } from "./OptionSelectPopover";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.option) return `${key}:${params.option}`;
      return key;
    },
  }),
}));

describe("OptionSelectPopover", () => {
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

  it("renders trigger button and handles selection and keyboard events", async () => {
    const onChange = vi.fn();
    const options = ["Option Alpha", "Option Beta", "Option Gamma"];

    await act(async () => {
      root.render(
        <OptionSelectPopover
          options={options}
          value="Option Alpha"
          onChange={onChange}
          placeholder="Select one"
        />,
      );
    });

    const trigger = container.querySelector("button") as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain("Option Alpha");

    // Open the popover by clicking trigger
    await act(async () => {
      trigger.click();
    });

    // Options should now be visible
    const optionElements = Array.from(document.querySelectorAll('[role="option"]'));
    expect(optionElements.length).toBe(3);

    // Click second option
    await act(async () => {
      (optionElements[1] as HTMLElement).click();
    });
    expect(onChange).toHaveBeenCalledWith("Option Beta");

    // Reopen popover and test keyboard navigation
    await act(async () => {
      trigger.click();
    });

    const refreshedOptions = Array.from(document.querySelectorAll('[role="option"]'));
    await act(async () => {
      refreshedOptions[2].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onChange).toHaveBeenCalledWith("Option Gamma");
  });

  it("supports removing options when onUpdateOptions is provided", async () => {
    const onChange = vi.fn();
    const onUpdateOptions = vi.fn();
    const options = ["Apple", "Banana", "Cherry"];

    await act(async () => {
      root.render(
        <OptionSelectPopover
          options={options}
          value="Banana"
          onChange={onChange}
          onUpdateOptions={onUpdateOptions}
        />,
      );
    });

    const trigger = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });

    // Remove buttons should be present
    const removeButtons = Array.from(document.querySelectorAll("button")).filter((btn) =>
      btn.getAttribute("aria-label")?.includes("contacts.form.removeOption"),
    );
    expect(removeButtons.length).toBe(3);

    // Remove "Banana" (which is the currently selected value)
    await act(async () => {
      removeButtons[1].click();
    });

    expect(onUpdateOptions).toHaveBeenCalledWith(["Apple", "Cherry"]);
    expect(onChange).toHaveBeenCalledWith("Apple");
  });
});
