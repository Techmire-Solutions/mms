import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useGlobalUsers.js", () => ({
  useGlobalUsers: () => ({
    isPending: false,
    isError: false,
    data: {
      items: [
        {
          tenant: "acme",
          user: {
            id: "u1",
            name: "Amina",
            email: "amina@example.com",
            role: "teacher",
            status: "active",
          },
        },
      ],
    },
  }),
  useGlobalOrganizations: () => ({
    isPending: false,
    isError: false,
    data: { items: [{ subdomain: "acme", madrasaName: "Acme Madrasa", enabled: true }] },
  }),
}));

import { GlobalUsersTable } from "./GlobalUsersTable.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LABELS = {
  title: "Global users & organizations",
  searchPlaceholder: "Search users or organizations",
  users: "Users",
  organizations: "Organizations",
  empty: "No matches",
  loading: "Searching…",
  error: "Search failed. Try again.",
  impersonate: "Impersonate",
};

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

describe("GlobalUsersTable", () => {
  it("renders cross-tenant rows and forwards the impersonation target", () => {
    const onImpersonate = vi.fn();
    render(<GlobalUsersTable labels={LABELS} onImpersonate={onImpersonate} />);

    expect(container.textContent).toContain("Amina");
    expect(container.textContent).toContain("Acme Madrasa");

    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Impersonate",
    );
    expect(button).toBeDefined();
    act(() => button?.click());
    expect(onImpersonate).toHaveBeenCalledWith({
      tenant: "acme",
      userId: "u1",
      name: "Amina",
    });
  });

  it("hides the impersonate action without a handler", () => {
    render(<GlobalUsersTable labels={LABELS} />);
    expect(container.textContent).not.toContain("Impersonate");
  });
});
