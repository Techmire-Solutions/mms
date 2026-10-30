import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
    dir: "ltr",
    isRtl: false,
    isLoading: false,
  }),
}));

vi.mock("./useSidebarNav", () => ({
  useSidebarNav: () => ({
    location: { pathname: "/" },
    openMenus: new Set<string>(),
    toggleMenu: vi.fn(),
    visibleMenuItems: [],
  }),
}));

vi.mock("./SidebarBrand", () => ({
  SidebarBrand: () => null,
}));

vi.mock("./SidebarNav", () => ({
  SidebarNav: () => null,
}));

describe("Sidebar", () => {
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

  it("given a collapsed sidebar, should expose the expand action name and state when rendered", async () => {
    // Act
    await act(async () => {
      root.render(<Sidebar collapsed onToggle={() => {}} />);
    });

    // Assert
    const toggle = container.querySelector<HTMLButtonElement>("button");
    expect(toggle?.getAttribute("aria-label")).toBe("nav.expand");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  });

  it("given an expanded sidebar, should expose the collapse action name and state when rendered", async () => {
    // Act
    await act(async () => {
      root.render(<Sidebar collapsed={false} onToggle={() => {}} />);
    });

    // Assert
    const toggle = container.querySelector<HTMLButtonElement>("button");
    expect(toggle?.getAttribute("aria-label")).toBe("nav.collapse");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle?.textContent).toContain("nav.collapse");
  });
});
