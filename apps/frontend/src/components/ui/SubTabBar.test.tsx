import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubTabBar, type SubTab } from "./SubTabBar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SubTabBar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const mockTabs: readonly SubTab<"general" | "security" | "billing">[] = [
    { key: "general", label: "General", badge: 3 },
    { key: "security", label: "Security" },
    { key: "billing", label: "Billing" },
  ];

  it("renders pill variant by default and triggers onChange", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(<SubTabBar tabs={mockTabs} value="general" onChange={handleChange} />);
    });

    expect(container.textContent).toContain("General");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("Security");

    const securityButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Security"),
    );
    expect(securityButton).toBeDefined();

    await act(async () => {
      securityButton?.click();
    });

    expect(handleChange).toHaveBeenCalledWith("security");
  });

  it("renders underline variant", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <SubTabBar tabs={mockTabs} value="billing" onChange={handleChange} variant="underline" />,
      );
    });

    expect(container.textContent).toContain("Billing");
    const selectedTab = container.querySelector('[aria-selected="true"]');
    expect(selectedTab?.textContent).toContain("Billing");
  });

  it("renders accordion variant when children are provided", async () => {
    const handleChange = vi.fn();

    await act(async () => {
      root.render(
        <SubTabBar tabs={mockTabs} value="general" onChange={handleChange}>
          <div data-testid="panel-content">Content for general</div>
        </SubTabBar>,
      );
    });

    expect(container.textContent).toContain("Content for general");
    expect(container.querySelector('[aria-expanded="true"]')).toBeDefined();
  });
});
