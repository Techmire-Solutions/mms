import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Breadcrumb component - Modern Web Guidance: accessibility, html", () => {
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

  const testItems: readonly BreadcrumbItem[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Students", href: "/students" },
    { label: "Admissions" },
  ];

  it("renders semantic <nav>, <ol>, and <li> elements with aria-label", async () => {
    await act(async () => {
      root.render(<Breadcrumb items={testItems} ariaLabel="Breadcrumbs" />);
    });

    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Breadcrumbs");

    const ol = nav?.querySelector("ol");
    expect(ol).not.toBeNull();

    const lis = ol?.querySelectorAll("li");
    expect(lis?.length).toBe(3);
  });

  it("marks the final item with aria-current='page'", async () => {
    await act(async () => {
      root.render(<Breadcrumb items={testItems} ariaLabel="Navigation" />);
    });

    const currentItem = container.querySelector('[aria-current="page"]');
    expect(currentItem).not.toBeNull();
    expect(currentItem?.textContent).toBe("Admissions");
  });

  it("renders anchor links for non-terminal items with href", async () => {
    await act(async () => {
      root.render(<Breadcrumb items={testItems} ariaLabel="Breadcrumbs" />);
    });

    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute("href")).toBe("/dashboard");
    expect(links[0]?.textContent).toBe("Dashboard");
    expect(links[1]?.getAttribute("href")).toBe("/students");
    expect(links[1]?.textContent).toBe("Students");
  });

  it("supports custom renderLink function", async () => {
    const customRender = vi.fn((item: BreadcrumbItem, children: React.ReactNode) => (
      <span data-custom-link={item.href}>{children}</span>
    ));

    await act(async () => {
      root.render(
        <Breadcrumb items={testItems} ariaLabel="Breadcrumbs" renderLink={customRender} />,
      );
    });

    const customLinks = container.querySelectorAll("[data-custom-link]");
    expect(customLinks.length).toBe(2);
    expect(customRender).toHaveBeenCalledTimes(2);
  });
});
