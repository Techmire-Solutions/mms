import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormErrorBanner } from "./FormErrorBanner";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("FormErrorBanner", () => {
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

  it("given a form-level error appears, should announce it as an alert and move focus to it when rendered", async () => {
    // Arrange
    await act(async () => {
      root.render(<FormErrorBanner errors={[]} />);
    });

    // Act
    await act(async () => {
      root.render(<FormErrorBanner errors={["Amount is required"]} />);
    });

    // Assert
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Amount is required");
    expect(document.activeElement).toBe(alert);
  });

  it("given the same error banner re-renders with more errors, should not steal focus again when updated", async () => {
    // Arrange
    await act(async () => {
      root.render(<FormErrorBanner errors={["Amount is required"]} />);
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    // Act
    await act(async () => {
      root.render(<FormErrorBanner errors={["Amount is required", "Date is required"]} />);
    });

    // Assert
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("renders operable summary items when an onSelectError handler is provided", async () => {
    const onSelectError = vi.fn();
    await act(async () => {
      root.render(
        <FormErrorBanner
          errors={["First name is required", "Phone is required"]}
          onSelectError={onSelectError}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.className ?? "").toContain("min-h-11");

    await act(async () => {
      buttons[1]?.click();
    });

    expect(onSelectError).toHaveBeenCalledWith(1);
  });

  it("given no errors, should render nothing when an empty list is passed", async () => {
    // Act
    await act(async () => {
      root.render(<FormErrorBanner errors={[]} />);
    });

    // Assert
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
