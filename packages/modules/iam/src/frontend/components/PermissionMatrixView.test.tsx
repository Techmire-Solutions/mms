import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PermissionMatrixView } from "./PermissionMatrixView.js";
import { RoleBadge } from "./RoleBadge.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(node));
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("IAM shared widgets", () => {
  it("renders a role badge with platform-managed hint", () => {
    render(
      <RoleBadge
        label="Super Admin"
        platformManaged
        platformManagedLabel="Platform-managed"
        roleId="super_admin"
      />,
    );
    expect(container.textContent).toContain("Super Admin");
    expect(container.textContent).toContain("Platform-managed");
  });

  it("renders the permission matrix from props without network access", () => {
    render(
      <PermissionMatrixView
        labels={{
          read: "Read",
          write: "Write",
          delete: "Delete",
          none: "—",
          searchPlaceholder: "Search",
        }}
        modules={[{ id: "users", label: "Users" }]}
        permissions={{ users: ["read"] }}
      />,
    );
    expect(container.textContent).toContain("Users");
    expect(container.textContent).toContain("Read");
    expect(container.querySelector("input")?.getAttribute("placeholder")).toBe("Search");
  });
});
