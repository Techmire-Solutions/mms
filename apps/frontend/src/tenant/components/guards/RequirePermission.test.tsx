import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

import RequirePermission from "./RequirePermission";

describe("RequirePermission", () => {
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

  function render() {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/setup"]}>
          <Routes>
            <Route
              path="/setup"
              element={
                <RequirePermission permission="settings.branding.write">
                  <div>setup-content</div>
                </RequirePermission>
              }
            />
            <Route path="/" element={<div>home-content</div>} />
            <Route path="/login" element={<div>login-content</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it("redirects a guest to login", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null });
    render();
    expect(container.textContent).toContain("login-content");
  });

  it("redirects a role without branding-write to home", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: "teacher" } });
    render();
    expect(container.textContent).toContain("home-content");
    expect(container.textContent).not.toContain("setup-content");
  });

  it("renders the children for a permitted role", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: "admin" } });
    render();
    expect(container.textContent).toContain("setup-content");
  });
});
