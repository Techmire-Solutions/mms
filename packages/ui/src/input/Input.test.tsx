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

  it("includes native user-invalid styling classes", async () => {
    await act(async () => {
      root.render(<Input placeholder="Email" type="email" required />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.className).toContain("user-invalid:border-destructive");
  });

  it("applies user-valid styling classes when showValidState is enabled", async () => {
    await act(async () => {
      root.render(<Input placeholder="Email" type="email" required showValidState />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.className).toContain("user-valid:border-success/60");
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

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-errormessage")).toMatch(/-error$/);
  });

  it("synchronizes aria-invalid dynamically on blur when native validation fails and clears on valid input", async () => {
    await act(async () => {
      root.render(<Input placeholder="Required Field" required />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBeNull();

    // Trigger blur while field is empty (invalid)
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(input.getAttribute("aria-invalid")).toBe("true");

    // Provide valid input and fire input event
    await act(async () => {
      input.value = "Valid Value";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("applies group/form-field and parent invalid selector classes on FormField wrapper and label", async () => {
    await act(async () => {
      root.render(
        <FormField label="Email Address" required>
          <Input type="email" placeholder="name@domain.com" required />
        </FormField>,
      );
    });

    const wrapper = container.querySelector(".group\\/form-field");
    expect(wrapper).not.toBeNull();

    const label = container.querySelector("label");
    expect(label?.className).toContain("group-has-[:user-invalid]/form-field:text-destructive");
  });
});
