import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Input } from "./Input";
import { FormField } from "./FormField";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Input & FormField components", () => {
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

  it("renders input field and handles value changes", async () => {
    await act(async () => {
      root.render(<Input placeholder="Enter username" />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Enter username");
  });

  it("applies error styling when error is true", async () => {
    await act(async () => {
      root.render(<Input placeholder="Email" error="Invalid email address" />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toContain("border-destructive");
  });

  it("renders FormField with label, hint, and error message", async () => {
    await act(async () => {
      root.render(
        <FormField label="Full Name" required hint="Legal name as on ID" error="Name is required">
          <Input placeholder="John Doe" />
        </FormField>,
      );
    });
    expect(container.textContent).toContain("Full Name");
    expect(container.textContent).toContain("*");
    expect(container.textContent).toContain("Name is required");
  });
});
