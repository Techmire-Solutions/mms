import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailOverview } from "./ContactDetailOverview";

vi.mock("./ContactDetailHeroCard", () => ({
  ContactDetailHeroCard: ({ contact }: { contact: Contact }) => (
    <div data-testid="overview-hero">{contact.name}</div>
  ),
}));

vi.mock("./ContactDetailOverviewQuickActions", () => ({
  ContactDetailOverviewQuickActions: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

vi.mock("./ContactDetailCollections", () => ({
  ContactDetailCollections: () => <div data-testid="collections">Collections</div>,
}));

vi.mock("./ContactDetailNetwork", () => ({
  ContactDetailNetwork: () => <div data-testid="network">Network</div>,
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    enabledTabIds: new Set(["phones", "emails", "relationship"]),
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

describe("ContactDetailOverview Component", () => {
  it("renders overview hero, collections, and network sections", () => {
    const html = renderToStaticMarkup(
      <ContactDetailOverview
        contact={mockContact}
        allContacts={[mockContact]}
        grouped={{}}
        formatFieldValue={() => null}
        visibleCollectionFields={{
          phones: [{ enabled: true }],
          emails: [{ enabled: true }],
          addresses: [],
          socials: [],
          education: [],
          experience: [],
          skills: [],
          relationship: [{ enabled: true }],
        }}
        primaryPhone="+92 300 1234567"
        primaryEmail="zayd@example.com"
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("Collections");
    expect(html).toContain("Network");
  });
});
