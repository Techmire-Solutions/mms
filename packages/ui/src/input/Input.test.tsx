import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";
import { FormField } from "./FormField";

describe("Input & FormField components", () => {
  it("renders input field and handles value changes", () => {
    render(<Input placeholder="Enter username" />);
    const input = screen.getByPlaceholderText("Enter username");
    expect(input).toBeDefined();
  });

  it("applies error styling when error is true", () => {
    render(<Input placeholder="Email" error="Invalid email address" />);
    const input = screen.getByPlaceholderText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toContain("border-destructive");
  });

  it("renders FormField with label, hint, and error message", () => {
    render(
      <FormField label="Full Name" required hint="Legal name as on ID" error="Name is required">
        <Input placeholder="John Doe" />
      </FormField>,
    );
    expect(screen.getByText("Full Name")).toBeDefined();
    expect(screen.getByText("*")).toBeDefined();
    expect(screen.getByText("Name is required")).toBeDefined();
  });
});
