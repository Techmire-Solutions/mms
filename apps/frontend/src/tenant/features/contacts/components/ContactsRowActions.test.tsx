import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactsRowActions } from "./ContactsRowActions";

vi.mock("@/components/app/ModuleRowActionsMenu", () => ({
  ModuleRowActionsMenu: ({
    viewLabel,
    editLabel,
    deleteLabel,
    restoreLabel,
  }: {
    viewLabel: string;
    editLabel: string;
    deleteLabel: string;
    restoreLabel: string;
  }) => (
    <div data-testid="row-actions-menu">
      <span>{viewLabel}</span>
      <span>{editLabel}</span>
      <span>{deleteLabel}</span>
      <span>{restoreLabel}</span>
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

describe("ContactsRowActions Component", () => {
  it("renders row actions menu with action labels", () => {
    const html = renderToStaticMarkup(
      <ContactsRowActions
        contact={mockContact}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.table.viewProfile");
    expect(html).toContain("contacts.table.edit");
    expect(html).toContain("contacts.table.deleteContact");
  });
});
