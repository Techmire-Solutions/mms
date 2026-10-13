import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AddUserModal } from "./AddUserModal";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    passwordPolicy: "strong",
    dateFormat: "YYYY-MM-DD",
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useUsersConfig: () => ({
    customFields: [],
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ title, subtitle, children }: any) => (
    <div data-testid="form-modal">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      {children}
    </div>
  ),
}));

vi.mock("./AddUserModalStep1", () => ({
  Step1: ({ form, setForm, errors }: any) => (
    <div data-testid="step-1">
      <span data-testid="step1-errors">{JSON.stringify(errors)}</span>
      <button
        data-testid="pick-contact-btn"
        onClick={() =>
          setForm((prev: any) => ({
            ...prev,
            contactId: "c1",
            name: "John Doe",
            email: "john@example.com",
            phone: "+1234567890",
          }))
        }
      >
        Pick Contact
      </button>
      <button
        data-testid="pick-duplicate-contact-btn"
        onClick={() =>
          setForm((prev: any) => ({
            ...prev,
            contactId: "c2",
            name: "Duplicate",
            email: "duplicate@example.com",
          }))
        }
      >
        Pick Duplicate
      </button>
    </div>
  ),
}));

vi.mock("./AddUserModalStep2", () => ({
  Step2: ({ form, setForm, errors }: any) => (
    <div data-testid="step-2">
      <span data-testid="step2-errors">{JSON.stringify(errors)}</span>
      <button
        data-testid="pick-role-btn"
        onClick={() => setForm((prev: any) => ({ ...prev, role: "teacher" }))}
      >
        Pick Role
      </button>
    </div>
  ),
}));

vi.mock("./AddUserModalStep3", () => ({
  Step3: ({ errors }: any) => (
    <div data-testid="step-3">
      <span data-testid="step3-errors">{JSON.stringify(errors)}</span>
    </div>
  ),
}));

describe("AddUserModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates step 1 contact selection before allowing next step", () => {
    const onClose = vi.fn();
    const onAdd = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <AddUserModal onClose={onClose} onAdd={onAdd} existingEmails={["duplicate@example.com"]} />,
      );
    });

    expect(container.querySelector('[data-testid="step-1"]')).not.toBeNull();

    // Click Next without contact selected
    const nextBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("users.addNext"),
    );
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Still on step 1 due to validation error
    expect(container.querySelector('[data-testid="step-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="step1-errors"]')?.textContent).toContain(
      "users.addErrorContact",
    );

    act(() => {
      root.unmount();
    });
  });

  it("prevents progressing if selected contact email already exists", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <AddUserModal
          onClose={vi.fn()}
          onAdd={vi.fn()}
          existingEmails={["duplicate@example.com"]}
        />,
      );
    });

    const duplicateBtn = container.querySelector('[data-testid="pick-duplicate-contact-btn"]');
    act(() => {
      duplicateBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const nextBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("users.addNext"),
    );
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="step1-errors"]')?.textContent).toContain(
      "users.addErrorContactExists",
    );

    act(() => {
      root.unmount();
    });
  });

  it("progresses through step 1, step 2, and submits in step 3", async () => {
    const onClose = vi.fn();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<AddUserModal onClose={onClose} onAdd={onAdd} />);
    });

    // Step 1: Pick valid contact
    const pickContactBtn = container.querySelector('[data-testid="pick-contact-btn"]');
    act(() => {
      pickContactBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Go to Step 2
    let nextBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("users.addNext"),
    );
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="step-2"]')).not.toBeNull();

    // Step 2: Pick role
    const pickRoleBtn = container.querySelector('[data-testid="pick-role-btn"]');
    act(() => {
      pickRoleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Go to Step 3
    nextBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("users.addNext"),
    );
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="step-3"]')).not.toBeNull();

    // Step 3: Submit Create
    const createBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("users.addCreate"),
    );
    await act(async () => {
      createBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "c1",
        name: "John Doe",
        email: "john@example.com",
        role: "teacher",
      }),
    );
    expect(onClose).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });
});
