import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactNetworkLinkCard } from "./ContactNetworkLinkCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === "contacts.detail.viewContact" && params?.name) {
        return `View ${params.name}`;
      }
      const labels: Record<string, string> = {
        "contacts.detail.unknownContact": "Unknown Contact",
        "contacts.fields.linkedContact": "Linked Contact",
        "contacts.detail.call": "Call",
      };
      return labels[key] ?? key;
    },
  }),
}));

const mockTargetContact: Contact = {
  id: "cnt-42",
  name: "Zainab Ali",
  firstName: "Zainab",
  lastName: "Ali",
  phone: "+964 770 123 4567",
  email: "zainab@madrasa.com",
  gender: "female",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactNetworkLinkCard Component", () => {
  it("renders target contact with display name, relationship label, and avatar", () => {
    const html = renderToStaticMarkup(
      <ContactNetworkLinkCard
        displayName="Zainab Ali"
        relationshipLabel="Mother"
        avatarId="cnt-42"
        target={mockTargetContact}
        targetPhone="+964 770 123 4567"
        targetEmail="zainab@madrasa.com"
        legacyPhone=""
        showTargetMessaging={true}
        showLegacyCall={false}
        canNavigate={true}
        linkedId="cnt-42"
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Zainab Ali");
    expect(html).toContain("Mother");
    expect(html).toContain('aria-label="View Zainab Ali"');
    expect(html).toContain("lucide-arrow-up-right");
  });

  it("renders fallback unknown contact name when displayName is empty", () => {
    const html = renderToStaticMarkup(
      <ContactNetworkLinkCard
        displayName=""
        relationshipLabel="Guardian"
        avatarId="cnt-unknown"
        targetPhone={null}
        targetEmail={null}
        legacyPhone=""
        showTargetMessaging={false}
        showLegacyCall={false}
        canNavigate={false}
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Unknown Contact");
    expect(html).toContain("Guardian");
  });

  it("renders legacy phone call action when showLegacyCall=true", () => {
    const html = renderToStaticMarkup(
      <ContactNetworkLinkCard
        displayName="Uncle Jafar"
        relationshipLabel="Uncle"
        avatarId="uncle-1"
        targetPhone={null}
        targetEmail={null}
        legacyPhone="+1 555-9988"
        showTargetMessaging={false}
        showLegacyCall={true}
        canNavigate={false}
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Uncle Jafar");
    expect(html).toContain("tel:+15559988");
  });
});
