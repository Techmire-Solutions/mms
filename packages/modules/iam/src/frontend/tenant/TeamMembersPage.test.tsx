import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    members: [
      {
        id: "u1",
        name: "Amina",
        email: "amina@example.com",
        role: "teacher",
        status: "active" as const,
      },
      {
        id: "u2",
        name: "Bilal",
        email: "bilal@example.com",
        role: "admin",
        status: "active" as const,
      },
    ],
  },
}));

vi.mock("./hooks/useTeamMembers", () => ({
  useTeamMembers: () => ({
    data: { users: state.members },
    isPending: false,
    isError: false,
  }),
}));

import { TeamMembersPage } from "./TeamMembersPage.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LABELS = {
  title: "Team members",
  subtitle: "People with access to this workspace",
  searchPlaceholder: "Search members",
  empty: "No members",
  invite: "Invite",
  loading: "Loading…",
  error: "Could not load members",
  platformManaged: "Platform-managed",
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

describe("TeamMembersPage", () => {
  it("renders non-interactive rows when no member handler is supplied", () => {
    render(<TeamMembersPage labels={LABELS} />);
    expect(container.textContent).toContain("Amina");
    expect(container.querySelectorAll("li button")).toHaveLength(0);
  });

  it("opens a member from an interactive row", () => {
    const onOpenMember = vi.fn();
    render(<TeamMembersPage labels={LABELS} onOpenMember={onOpenMember} />);

    const rowButton = container.querySelector("li button");
    expect(rowButton).not.toBeNull();
    act(() => (rowButton as HTMLButtonElement).click());
    expect(onOpenMember).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
  });
});
