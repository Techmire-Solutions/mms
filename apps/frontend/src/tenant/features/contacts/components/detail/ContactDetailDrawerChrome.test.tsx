import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import {
  ContactDetailDrawerHeaderActions,
  ContactDetailDrawerArchivedBanner,
  ContactDetailDrawerTabBar,
  ContactDetailDrawerFooter,
} from "./ContactDetailDrawerChrome";

vi.mock("@/components/ui/DetailDrawerArchiveChrome", () => ({
  DetailDrawerRestoreOrEditAction: ({ editLabel }: { editLabel: string }) => (
    <div data-testid="edit-action">{editLabel}</div>
  ),
}));

vi.mock("@/components/ui/SubTabBar", () => ({
  SubTabBar: ({ value }: { value: string }) => <div data-testid="tab-bar">Tab: {value}</div>,
}));

vi.mock("@/components/ui/DrawerUpdatedStamp", () => ({
  DrawerUpdatedStamp: ({ label }: { label: string }) => (
    <div data-testid="updated-stamp">{label}</div>
  ),
}));

vi.mock("@/tenant/features/contacts/components/ContactArchivedBanner", () => ({
  ContactArchivedBanner: () => <div data-testid="archived-banner">Archived</div>,
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

describe("ContactDetailDrawerChrome Components", () => {
  it("renders header actions, archived banner, tab bar, and footer", () => {
    const htmlActions = renderToStaticMarkup(
      <ContactDetailDrawerHeaderActions
        canWrite={true}
        canDelete={true}
        contact={mockContact}
        onEdit={vi.fn()}
      />,
    );
    expect(htmlActions).toContain("contacts.detail.editProfile");

    const htmlBanner = renderToStaticMarkup(
      <ContactDetailDrawerArchivedBanner contact={mockContact} />,
    );
    expect(htmlBanner).toContain("Archived");

    const htmlTabBar = renderToStaticMarkup(
      <ContactDetailDrawerTabBar
        detailTabs={[{ key: "overview", label: "Overview" }]}
        activeTab="overview"
        onTabChange={vi.fn()}
      />,
    );
    expect(htmlTabBar).toContain("Tab: overview");

    const htmlFooter = renderToStaticMarkup(<ContactDetailDrawerFooter contact={mockContact} />);
    expect(htmlFooter).toContain("contacts.detail.updatedLabel");
  });
});
