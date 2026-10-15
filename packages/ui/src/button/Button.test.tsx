import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";
import { Badge } from "./Badge";

describe("Button component", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDefined();
    expect(button.className).toContain("bg-primary");
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables button and shows spinner when isLoading is true", () => {
    render(<Button isLoading loadingText="Processing...">Submit</Button>);
    const button = screen.getByRole("button");
    expect(button.getAttribute("disabled")).not.toBeNull();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Processing...")).toBeDefined();
  });

  it("renders badge variants correctly", () => {
    render(<Badge variant="destructive">Failed</Badge>);
    const badge = screen.getByText("Failed");
    expect(badge.className).toContain("bg-destructive");
  });
});
