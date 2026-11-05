import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsBulkTagModal } from "./ContactsBulkTagModal";

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    open,
    title,
    children,
    saveLabel,
    onSave,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    saveLabel?: string;
    onSave?: () => Promise<void> | void;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <button type="button" onClick={() => void onSave?.()}>
          {saveLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({ tags: ["VIP", "Donor"] }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

describe("ContactsBulkTagModal Component", () => {
  it("renders modal with tag input and action buttons when open", () => {
    const html = renderToStaticMarkup(
      <ContactsBulkTagModal open={true} onClose={vi.fn()} selectedCount={4} onConfirm={vi.fn()} />,
    );

    expect(html).toContain("contacts.bulkTagTitle");
    expect(html).toContain("contacts.selectedCount:4");
    expect(html).toContain("contacts.bulkTagAdd");
  });

  it("returns null when open is false", () => {
    const html = renderToStaticMarkup(
      <ContactsBulkTagModal open={false} onClose={vi.fn()} selectedCount={4} onConfirm={vi.fn()} />,
    );

    expect(html).toBe("");
  });

  it("rejects reserved system tag names without confirming", async () => {
    const { notify } = await import("@/lib/notify");
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContactsBulkTagModal
            open={true}
            onClose={onClose}
            selectedCount={2}
            onConfirm={onConfirm}
          />,
        );
      });

      const input = container.querySelector<HTMLInputElement>("#bulk-tag-input");
      expect(input).not.toBeNull();
      if (!input) return;

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      await act(async () => {
        nativeSetter?.call(input, "faculty-Teacher");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "contacts.bulkTagAdd",
      );
      expect(saveButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        saveButton?.click();
      });

      expect(notify.error).toHaveBeenCalledWith("contacts.tags.reserved");
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(container.textContent).toContain("contacts.bulkTagTitle");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});

describe("ContactsBulkTagModal mode and reset behaviour", () => {
  it("confirms remove mode so the parent can send removeTags", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContactsBulkTagModal
            open={true}
            onClose={onClose}
            selectedCount={2}
            onConfirm={onConfirm}
          />,
        );
      });

      const removeMode = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "contacts.bulkTagModeRemove",
      );
      expect(removeMode).toBeInstanceOf(HTMLButtonElement);
      await act(async () => {
        removeMode?.click();
      });

      const input = container.querySelector<HTMLInputElement>("#bulk-tag-input");
      if (!input) throw new Error("tag input missing");
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      await act(async () => {
        nativeSetter?.call(input, "VIP");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "contacts.bulkTagModeRemove" && button !== removeMode,
      );
      await act(async () => {
        saveButton?.click();
      });

      expect(onConfirm).toHaveBeenCalledWith(["VIP"], "remove");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("clears the previous input when the modal reopens after a cancel", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderModal = (open: boolean) => (
      <ContactsBulkTagModal open={open} onClose={vi.fn()} selectedCount={1} onConfirm={vi.fn()} />
    );

    try {
      await act(async () => {
        root.render(renderModal(true));
      });
      const input = container.querySelector<HTMLInputElement>("#bulk-tag-input");
      if (!input) throw new Error("tag input missing");
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      await act(async () => {
        nativeSetter?.call(input, "VIP");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      await act(async () => {
        root.render(renderModal(false));
      });
      await act(async () => {
        root.render(renderModal(true));
      });

      expect(container.querySelector<HTMLInputElement>("#bulk-tag-input")?.value ?? "").toBe("");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
