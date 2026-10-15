import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { EditUserModal } from "./EditUserModal";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockActorRole = "super_admin";
let mockContact: {
  id: string;
  name: string;
  emails: { address: string; isPrimary: boolean }[];
  phones: { number: string; isPrimary: boolean }[];
} = {
  id: "c1",
  name: "Updated Contact Name",
  emails: [{ address: "contact@example.com", isPrimary: true }],
  phones: [{ number: "+1234567890", isPrimary: true }],
};

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "actor-1", role: mockActorRole },
  }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    { id: "admin", name: "Admin", labelKey: "roles.admin" },
    { id: "teacher", name: "Teacher", labelKey: "roles.teacher" },
    { id: "super_admin", name: "Super Admin", labelKey: "roles.super_admin" },
  ],
}));

const mockCustomFields = [{ id: "department", label: "Department", defaultValue: "General" }];

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useUsersConfig: () => ({
    customFields: mockCustomFields,
  }),
}));

vi.mock("@/tenant/hooks/collections/contacts", () => ({
  useContactById: (_id?: string, enabled?: boolean) => ({
    data: enabled ? mockContact : undefined,
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    title,
    subtitle,
    children,
    onSave,
    saveDisabled,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    children?: React.ReactNode;
    onSave?: () => void;
    saveDisabled?: boolean;
  }) => (
    <div data-testid="form-modal">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      <button data-testid="modal-save-btn" disabled={saveDisabled} onClick={onSave}>
        Save
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
    <div data-testid="contact-picker">
      <span data-testid="contact-val">{value}</span>
      <button data-testid="change-contact-btn" onClick={() => onChange("c1")}>
        Change Contact
      </button>
    </div>
  ),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EditUserModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActorRole = "super_admin";
    mockContact = {
      id: "c1",
      name: "Updated Contact Name",
      emails: [{ address: "contact@example.com", isPrimary: true }],
      phones: [{ number: "+1234567890", isPrimary: true }],
    };
  });

  it("renders edit form with user details and custom fields", () => {
    const user = normalizeWorkspaceUser({
      id: "u1",
      name: "Existing User",
      email: "existing@test.com",
      role: "admin",
      status: "active",
      contactId: "c1",
    });
    const onClose = vi.fn();
    const onSave = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<EditUserModal user={user} onClose={onClose} onSave={onSave} />);
    });

    expect(container.textContent).toContain("Updated Contact Name");
    expect(container.querySelector('[data-testid="contact-picker"]')).not.toBeNull();
    expect(container.querySelector('input[id="custom-field-department"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("shows warning when standard admin tries to edit super admin", () => {
    mockActorRole = "admin";
    const user = normalizeWorkspaceUser({
      id: "u-super",
      name: "Super User",
      email: "super@test.com",
      role: "super_admin",
      status: "active",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<EditUserModal user={user} onClose={vi.fn()} onSave={vi.fn()} />);
    });

    expect(container.textContent).toContain("users.errors.cannotModifySuperAdmin");
    const saveBtn = container.querySelector('[data-testid="modal-save-btn"]');
    expect(saveBtn?.hasAttribute("disabled")).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("submits updated user data on save", async () => {
    const user = normalizeWorkspaceUser({
      id: "u1",
      name: "Existing User",
      email: "existing@test.com",
      role: "admin",
      status: "active",
      contactId: "c1",
    });
    const onSave = vi.fn();
    const onClose = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<EditUserModal user={user} onClose={onClose} onSave={onSave} />);
    });

    const roleBtn = container.querySelectorAll('button[type="button"]')[1];
    act(() => {
      roleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "u1",
        name: "Updated Contact Name",
        email: "contact@example.com",
        contactId: "c1",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
