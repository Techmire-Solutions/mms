import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetail } from "./ContactDetail";

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    title,
    children,
    headerActions,
    headerExtra,
  }: {
    title: string;
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    headerExtra?: React.ReactNode;
  }) => (
    <div data-testid="detail-drawer">
      <h2>{title}</h2>
      <div>{headerActions}</div>
      <div>{headerExtra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactDetailViewModel", () => ({
  useContactDetailViewModel: ({ initialContact }: { initialContact: Contact }) => ({
    contactState: initialContact,
    setContactState: vi.fn(),
    canPersistContact: true,
    detailTabs: [{ id: "overview", label: "Overview", count: 0 }],
    activeTab: "overview",
    setActiveTab: vi.fn(),
    grouped: [],
    formatFieldValue: vi.fn(),
    visibleCollectionFields: [],
    combinedActivities: [],
    primaryPhone: null,
    primaryEmail: null,
    handleAddNote: vi.fn(),
    handleNavigateToContact: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactDetailAttachments", () => ({
  useContactDetailAttachments: () => ({
    isDragging: false,
    setIsDragging: vi.fn(),
    isUploading: false,
    pendingAttachmentDelete: null,
    setPendingAttachmentDelete: vi.fn(),
    fileInputRef: { current: null },
    handleFiles: vi.fn(),
    handleFileChange: vi.fn(),
    confirmAttachmentDelete: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/contacts/components/detail/ContactDetailDrawerContent", () => ({
  ContactDetailDrawerContent: () => (
    <div data-testid="drawer-content">DetailDrawerShell Content</div>
  ),
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
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetail Component", () => {
  it("renders detail drawer with contact name and drawer content", () => {
    const html = renderToStaticMarkup(
      <ContactDetail contact={mockContact} onClose={vi.fn()} onEdit={vi.fn()} />,
    );

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("DetailDrawerShell Content");
  });
});
