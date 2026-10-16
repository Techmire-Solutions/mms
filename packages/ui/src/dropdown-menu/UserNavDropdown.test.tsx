import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserNavDropdown } from "./UserNavDropdown";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("UserNavDropdown Component (@shared/ui)", () => {
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

  it("renders trigger button with user display name", () => {
    const html = renderToStaticMarkup(
      <UserNavDropdown
        name="Syeda Fatima"
        email="fatima@example.com"
        signOutLabel="Sign out"
        onSignOut={vi.fn()}
      />,
    );

    expect(html).toContain("Syeda Fatima");
    expect(html).toContain("fatima@example.com");
    expect(html).toContain("SF");
  });

  it("renders subtitle when provided", () => {
    const html = renderToStaticMarkup(
      <UserNavDropdown
        name="Zaid"
        subtitle={<span data-testid="role-badge">Super Admin</span>}
        signOutLabel="Log Out"
        onSignOut={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="role-badge"');
    expect(html).toContain("Super Admin");
  });

  it("supports compact mode with 11x11 dimension classes", () => {
    const html = renderToStaticMarkup(
      <UserNavDropdown name="Operator" compact signOutLabel="Sign Out" onSignOut={vi.fn()} />,
    );

    expect(html).toContain("h-11 w-11 min-w-11");
  });

  it("renders custom children in open dropdown menu and triggers onSignOut", async () => {
    const handleSignOut = vi.fn();
    await act(async () => {
      root.render(
        <UserNavDropdown name="Admin" open={true} signOutLabel="Sign Out" onSignOut={handleSignOut}>
          <div data-testid="custom-item">Settings Option</div>
        </UserNavDropdown>,
      );
    });

    expect(document.body.textContent).toContain("Settings Option");
    expect(document.body.textContent).toContain("Sign Out");

    const signOutBtn = Array.from(document.body.querySelectorAll("[role='menuitem']")).find((el) =>
      el.textContent?.includes("Sign Out"),
    ) as HTMLElement | undefined;

    expect(signOutBtn).toBeTruthy();
    signOutBtn?.click();
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
