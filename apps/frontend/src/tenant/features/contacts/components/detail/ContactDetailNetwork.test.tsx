import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailNetwork } from "./ContactDetailNetwork";

vi.mock("./contactDetailChannelHelpers", () => ({
  DetailCollectionEmpty: ({ title }: { title: string }) => (
    <div data-testid="empty-relationships">{title}</div>
  ),
}));

vi.mock("./ContactNetworkLinkCard", () => ({
  ContactNetworkLinkCard: ({
    displayName,
    relationshipLabel,
  }: {
    displayName: string;
    relationshipLabel: string;
  }) => (
    <div data-testid="network-card">
      <span>{displayName}</span>
      <span>{relationshipLabel}</span>
    </div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContactA: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  relationships: [{ contactId: "cnt-2", relationship: "Brother" }],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockContactB: Contact = {
  id: "cnt-2",
  name: "Usama Harith",
  firstName: "Usama",
  lastName: "Harith",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailNetwork Component", () => {
  it("renders network links between contacts", () => {
    const html = renderToStaticMarkup(
      <ContactDetailNetwork
        contact={mockContactA}
        allContacts={[mockContactA, mockContactB]}
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Usama Harith");
    expect(html).toContain("contacts.detail.relationships");
  });
});
