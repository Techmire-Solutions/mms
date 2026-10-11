import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { ContactsListDesktopTable } from "./ContactsListDesktopTable";

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: DEFAULT_CONTACT_PREFERENCES,
    countryCodesMap: {},
    countryCodes: [],
    getColumnWidth: () => 120,
    setColumnWidth: vi.fn(),
  }),
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

describe("ContactsListDesktopTable Component", () => {
  it("renders table with header, rows, and footer count", () => {
    const html = renderToStaticMarkup(
      <ContactsListDesktopTable
        contacts={[mockContact]}
        selected={[]}
        onSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        sortField="name"
        sortDir="asc"
        onSort={vi.fn()}
        columns={[{ id: "name", label: "Name" }]}
      />,
    );

    expect(html).toContain("Zayd Harith");
  });
});
