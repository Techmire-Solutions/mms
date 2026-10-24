import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailDrawerContent } from "./ContactDetailDrawerContent";

vi.mock("@/tenant/features/contacts/components/detail/ContactDetailOverview", () => ({
  ContactDetailOverview: () => <div data-testid="detail-overview">Overview</div>,
}));

vi.mock("@/tenant/features/contacts/components/detail/ContactDetailTimeline", () => ({
  ContactDetailTimeline: () => <div data-testid="detail-timeline">Timeline</div>,
}));

vi.mock("@/tenant/features/contacts/components/detail/ContactDetailFiles", () => ({
  ContactDetailFiles: () => <div data-testid="detail-files">Files</div>,
}));

vi.mock("@/tenant/features/contacts/components/detail/ContactDetailCustomCollections", () => ({
  ContactDetailCustomCollections: () => (
    <div data-testid="custom-collections">Custom Collections</div>
  ),
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    fields: [],
    enabledTabIds: ["overview", "timeline", "files"],
    formTabs: [],
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

describe("ContactDetailDrawerContent Component", () => {
  it("renders overview tab content by default", () => {
    const html = renderToStaticMarkup(
      <ContactDetailDrawerContent
        activeTab="overview"
        contactState={mockContact}
        allContacts={[]}
        grouped={{}}
        formatFieldValue={() => null}
        visibleCollectionFields={{
          phones: [],
          emails: [],
          addresses: [],
          socials: [],
          education: [],
          experience: [],
          skills: [],
          relationship: [],
        }}
        primaryPhone={null}
        primaryEmail={null}
        onNavigateToContact={vi.fn()}
        activities={[]}
        canPersistContact={true}
        onAddNote={vi.fn().mockResolvedValue(true)}
        isDragging={false}
        isUploading={false}
        fileInputRef={{ current: null }}
        onDraggingChange={vi.fn()}
        onFiles={vi.fn()}
        onFileChange={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(html).toContain("Overview");
  });
});
