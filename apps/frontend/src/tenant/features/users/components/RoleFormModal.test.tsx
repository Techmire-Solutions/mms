import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/shared";
import { RoleFormModal } from "./RoleFormModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const existing: WorkspaceRole = {
  id: "role_existing",
  labelKey: "users.role.custom",
  descriptionKey: "users.role.customDesc",
  customLabel: "Mentor",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { students: ["read"] },
};

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findButton(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${label} button not found`);
  return button;
}

describe("RoleFormModal", () => {
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
    document.body.innerHTML = "";
  });

  async function renderModal(
    props: Partial<React.ComponentProps<typeof RoleFormModal>> = {},
  ): Promise<void> {
    await act(async () => {
      root.render(
        <RoleFormModal
          open
          title="New role"
          visibleModules={[{ id: "students", labelKey: "nav.students" }]}
          onSave={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />,
      );
    });
  }

  it("creates a role with a normalised payload", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderModal({ onSave, existingRoles: [] });

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, "Librarian"),
    );
    await act(async () => findButton("users.permissions.saveRole").click());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        customLabel: "Librarian",
        isSystem: false,
        permissions: {},
      }),
    );
  });

  it("edits a role while preserving its existing metadata", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderModal({ onSave, role: existing, existingRoles: [existing] });

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, "Senior Mentor"),
    );
    await act(async () => findButton("users.permissions.saveRole").click());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "role_existing",
        labelKey: "users.role.custom",
        customLabel: "Senior Mentor",
        permissions: { students: ["read"] },
      }),
    );
  });

  it("blocks duplicate custom role names and never calls onSave", async () => {
    const onSave = vi.fn();
    await renderModal({ onSave, existingRoles: [existing] });

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, " mentor "),
    );
    await act(async () => findButton("users.permissions.saveRole").click());

    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("users.permissions.errorNameDuplicate");
  });

  it("closes a clean form without prompting", async () => {
    const onClose = vi.fn();
    await renderModal({ onClose, existingRoles: [] });

    await act(async () => findButton("users.cancel").click());

    expect(onClose).toHaveBeenCalled();
  });

  it("asks for confirmation before discarding a changed draft", async () => {
    await renderModal({ existingRoles: [] });

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, "Librarian"),
    );
    await act(async () => findButton("users.cancel").click());

    expect(document.body.textContent).toContain("users.permissions.discardUnsavedRoleFormConfirm");
  });
});
