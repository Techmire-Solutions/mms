import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailOverviewQuickActions } from "./ContactDetailOverviewQuickActions";

vi.mock("@/components/ui/EntityMessagingActions", () => ({
  EntityMessagingActions: ({
    primaryPhone,
    primaryEmail,
  }: {
    primaryPhone: string | null;
    primaryEmail: string | null;
  }) => (
    <div data-testid="quick-actions">
      <span>{primaryPhone}</span>
      <span>{primaryEmail}</span>
    </div>
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

describe("ContactDetailOverviewQuickActions Component", () => {
  it("renders quick actions with primary phone and email", () => {
    const html = renderToStaticMarkup(
      <ContactDetailOverviewQuickActions
        contact={mockContact}
        primaryPhone="+92 300 1234567"
        primaryEmail="zayd@example.com"
      />,
    );

    expect(html).toContain("+92 300 1234567");
    expect(html).toContain("zayd@example.com");
  });
});
