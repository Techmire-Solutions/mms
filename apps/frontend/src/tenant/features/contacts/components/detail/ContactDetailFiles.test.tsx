import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailFiles } from "./ContactDetailFiles";

vi.mock("@/components/ui/DashedFileDropZone", () => ({
  DashedFileDropZone: ({ title }: { title: string }) => <div data-testid="drop-zone">{title}</div>,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  attachments: [
    {
      id: "file-1",
      name: "id_card.pdf",
      size: 204800,
      type: "application/pdf",
      date: "2024-01-01T00:00:00Z",
      url: "https://example.com/id_card.pdf",
    },
  ],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailFiles Component", () => {
  it("renders drop zone and attachments list", () => {
    const html = renderToStaticMarkup(
      <ContactDetailFiles
        contact={mockContact}
        canPersistContact={true}
        isDragging={false}
        isUploading={false}
        fileInputRef={{ current: null }}
        onDraggingChange={vi.fn()}
        onFiles={vi.fn()}
        onFileChange={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.detail.cloudStorageRepository");
    expect(html).toContain("id_card.pdf");
    expect(html).toContain("200.0 contacts.detail.kbLabel");
  });
});
