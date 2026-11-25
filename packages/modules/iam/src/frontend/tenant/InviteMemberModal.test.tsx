import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/contracts";

const { state } = vi.hoisted(() => ({
  state: { mutate: vi.fn(), isPending: false, isError: false },
}));

vi.mock("./hooks/useTeamMembers.js", () => ({
  useInviteMember: () => ({
    mutate: state.mutate,
    isPending: state.isPending,
    isError: state.isError,
  }),
}));

import { InviteMemberModal } from "./InviteMemberModal.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LABELS = {
  title: "Invite member",
  email: "Email",
  role: "Role",
  submit: "Send invite",
  cancel: "Cancel",
  sending: "Sending…",
  error: "Invite failed",
  sent: "Invite sent",
  contactNotFound: "No contact matches that email",
};

const ROLES = [
  {
    id: "teacher",
    labelKey: "roles.teacher",
    descriptionKey: "roles.teacherDescription",
    isSystem: true,
    badgeVariant: "muted",
    permissions: {},
    customLabel: "Teacher",
  },
] as unknown as readonly WorkspaceRole[];

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(node));
}

function setInputValue(element: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(
    element,
    value,
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit(): Promise<void> {
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

afterEach(() => {
  state.mutate.mockReset();
  act(() => root.unmount());
  container.remove();
});

describe("InviteMemberModal", () => {
  it("resolves the email to a contact id before inviting", async () => {
    const resolveContact = vi.fn(async () => "contact-1");
    render(
      <InviteMemberModal
        labels={LABELS}
        onClose={vi.fn()}
        open
        resolveContact={resolveContact}
        roles={ROLES}
      />,
    );

    setInputValue(container.querySelector("input") as HTMLInputElement, "amina@example.com");
    await submit();

    expect(resolveContact).toHaveBeenCalledWith("amina@example.com");
    expect(state.mutate).toHaveBeenCalledWith(
      { contactId: "contact-1", role: "teacher", status: "inactive", sendEmail: true },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("refuses to invite when the email has no matching contact", async () => {
    const resolveContact = vi.fn(async () => null);
    render(
      <InviteMemberModal
        labels={LABELS}
        onClose={vi.fn()}
        open
        resolveContact={resolveContact}
        roles={ROLES}
      />,
    );

    setInputValue(container.querySelector("input") as HTMLInputElement, "ghost@example.com");
    await submit();

    expect(container.textContent).toContain("No contact matches that email");
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
