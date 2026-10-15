import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppSidebar } from "./AppSidebar";

describe("AppSidebar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  function render(collapsed: boolean, withBeforeNav = true): void {
    act(() => {
      root.render(
        <AppSidebar
          collapsed={collapsed}
          brand={<span>BRAND</span>}
          beforeNav={withBeforeNav ? <span>SEARCH</span> : undefined}
          footer={<span>FOOTER</span>}
        >
          <span>NAV</span>
        </AppSidebar>,
      );
    });
  }

  it("renders the brand, nav and footer slots in order", () => {
    render(false);
    expect(container.textContent).toContain("BRAND");
    expect(container.textContent).toContain("SEARCH");
    expect(container.textContent).toContain("NAV");
    expect(container.textContent).toContain("FOOTER");
  });

  it("renders the expanded width class when open and the collapsed width when collapsed", () => {
    render(false);
    const expanded = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(expanded).toContain("w-sidebar");
    expect(expanded).not.toContain("w-sidebar-collapsed");

    render(true);
    const collapsed = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(collapsed).toContain("w-sidebar-collapsed");
  });

  it("omits the optional beforeNav slot when not provided", () => {
    render(false, false);
    expect(container.textContent).not.toContain("SEARCH");
  });
});
