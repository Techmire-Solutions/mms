import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { APP_TRANSLATIONS_AR } from "@mms/shared/translations/ar";
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

const arabicTranslations = APP_TRANSLATIONS_AR as unknown as Record<string, string>;

function translate(key: string, params?: Record<string, string | number>): string {
  const template = arabicTranslations[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "ar",
    t: translate,
    isLoading: false,
    dir: "rtl",
    isRtl: true,
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

function renderTable(contacts: Contact[] = [mockContact]): string {
  return renderToStaticMarkup(
    <ContactsListDesktopTable
      contacts={contacts}
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
}

describe("ContactsListDesktopTable Component", () => {
  it("renders table with header, rows, and footer count", () => {
    const html = renderTable();

    expect(html).toContain("Zayd Harith");
  });

  it("localizes the select-all and per-row checkbox labels under the Arabic locale", () => {
    const secondContact: Contact = {
      ...mockContact,
      id: "cnt-2",
      name: "Ali Hassan",
      firstName: "Ali",
      lastName: "Hassan",
    };
    const html = renderTable([mockContact, secondContact]);
    const selectAllLabel = arabicTranslations["contacts.table.selectAll"] ?? "";
    const selectRowLabel = (name: string) =>
      (arabicTranslations["contacts.table.selectContact"] ?? "").replace("{name}", name);

    expect(html).toContain(`aria-label="${selectAllLabel}"`);
    expect(html).toContain(`aria-label="${selectRowLabel("Zayd Harith")}"`);
    expect(html).toContain(`aria-label="${selectRowLabel("Ali Hassan")}"`);
    expect(html).not.toContain("Select row");
  });

  it("never falls back to the internal row id for row checkbox labels", () => {
    const html = renderTable();

    expect(html).not.toContain("Select row cnt-1");
    expect(html).not.toContain('aria-label="cnt-1"');
  });
});
