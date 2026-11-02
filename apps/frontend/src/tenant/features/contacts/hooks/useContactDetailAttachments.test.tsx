import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import { useContactDetailAttachments } from "@/tenant/features/contacts/hooks/useContactDetailAttachments";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUploadAttachmentFile = vi.fn();
const mockDeleteAttachmentFile = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("@/lib/attachmentUpload", () => ({
  uploadAttachmentFile: (...args: unknown[]) => mockUploadAttachmentFile(...args),
  deleteAttachmentFile: (...args: unknown[]) => mockDeleteAttachmentFile(...args),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type Hook = ReturnType<typeof useContactDetailAttachments>;

const attachment = {
  id: "att-1",
  name: "a.pdf",
  type: "application/pdf",
  size: 4,
  url: "/uploads/tenants/demo/attachments/a.pdf",
  date: "2026-01-01",
};

const contactWithAttachment = {
  id: "c1",
  firstName: "Ali",
  name: "Ali",
  attachments: [attachment],
} as Contact;

function Harness({
  contact,
  onUpdateContact,
  onReady,
}: {
  contact: Contact;
  onUpdateContact: (next: Contact) => Promise<void>;
  onReady: (hook: Hook) => void;
}): React.JSX.Element {
  const [state, setState] = React.useState(contact);
  const hook = useContactDetailAttachments({
    contactState: state,
    setContactState: setState,
    canPersistContact: true,
    onUpdateContact,
  });
  onReady(hook);
  return <></>;
}

describe("useContactDetailAttachments", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockDeleteAttachmentFile.mockResolvedValue({ deleted: true });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("unlinks the removed file after a successful contact save", async () => {
    const onUpdateContact = vi.fn().mockResolvedValue(undefined);
    let hook!: Hook;
    await act(async () => {
      root.render(
        <Harness
          contact={contactWithAttachment}
          onUpdateContact={onUpdateContact}
          onReady={(value) => {
            hook = value;
          }}
        />,
      );
    });
    act(() => hook.setPendingAttachmentDelete({ id: "att-1", name: "a.pdf" }));

    await act(async () => hook.confirmAttachmentDelete());

    expect(onUpdateContact).toHaveBeenCalledWith(expect.objectContaining({ attachments: [] }));
    expect(mockDeleteAttachmentFile).toHaveBeenCalledWith(attachment.url);
  });

  it("does not unlink when the save fails", async () => {
    const onUpdateContact = vi.fn().mockRejectedValue(new Error("save failed"));
    let hook!: Hook;
    await act(async () => {
      root.render(
        <Harness
          contact={contactWithAttachment}
          onUpdateContact={onUpdateContact}
          onReady={(value) => {
            hook = value;
          }}
        />,
      );
    });
    act(() => hook.setPendingAttachmentDelete({ id: "att-1", name: "a.pdf" }));

    await act(async () => hook.confirmAttachmentDelete());

    expect(mockDeleteAttachmentFile).not.toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith("contacts.saveFailed");
  });

  it("stores the relative upload URL on the contact", async () => {
    mockUploadAttachmentFile.mockResolvedValue({
      url: "/uploads/tenants/demo/attachments/new.pdf",
      name: "new.pdf",
      type: "application/pdf",
      size: 4,
    });
    const onUpdateContact = vi.fn().mockResolvedValue(undefined);
    let hook!: Hook;
    await act(async () => {
      root.render(
        <Harness
          contact={{ id: "c1", firstName: "Ali", name: "Ali", attachments: [] } as Contact}
          onUpdateContact={onUpdateContact}
          onReady={(value) => {
            hook = value;
          }}
        />,
      );
    });

    const file = new File(["data"], "new.pdf", { type: "application/pdf" });
    await act(async () => hook.handleFiles([file] as unknown as FileList));

    expect(onUpdateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ url: "/uploads/tenants/demo/attachments/new.pdf" }),
        ],
      }),
    );
  });
});
