import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/contracts";
import { RoleFormModal } from "./RoleFormModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});

const systemAdminRole: WorkspaceRole = {
  id: "admin",
  labelKey: "users.role.admin",
  descriptionKey: "users.role.adminDesc",
  isSystem: true,
  badgeVariant: "primary",
  permissions: {},
};

const customMentorRole: WorkspaceRole = {
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

describe("RoleFormModal duplicate labels", () => {
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

  async function renderModal(existingRoles: WorkspaceRole[], onSave = vi.fn()): Promise<void> {
    await act(async () => {
      root.render(
        <RoleFormModal
          open
          title="New role"
          visibleModules={[{ id: "students", labelKey: "nav.students" }]}
          existingRoles={existingRoles}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });
  }

  it("blocks a custom role whose label duplicates a system role's display label", async () => {
    const onSave = vi.fn();
    await renderModal([systemAdminRole], onSave);

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, "Admin"),
    );
    await act(async () => findButton("Save Role").click());

    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("A custom role with this name already exists.");
  });

  it("allows a fresh label that matches no existing system or custom role", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderModal([systemAdminRole, customMentorRole], onSave);

    await act(async () =>
      setInputValue(document.body.querySelector("#role-name") as HTMLInputElement, "Archivist"),
    );
    await act(async () => findButton("Save Role").click());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ customLabel: "Archivist", isSystem: false }),
    );
  });
});
