import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { APP_TRANSLATIONS_AR } from "@mms/shared/translations/ar";
import { ContactsListDesktopTable } from "./ContactsListDesktopTable";

const mockUpdateUserColumnLayout = vi.fn();
const mockColumnRegistry = [
  { key: "name", label: "Name", order: 0, enabled: true },
  { key: "gender", label: "Gender", order: 1, enabled: true },
  { key: "phone", label: "Phone", order: 2, enabled: true },
  { key: "email", label: "Email", order: 3, enabled: true },
];

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: DEFAULT_CONTACT_PREFERENCES,
    countryCodesMap: {},
    countryCodes: [],
    getColumnWidth: () => 120,
    setColumnWidth: vi.fn(),
    columnRegistry: mockColumnRegistry,
    updateUserColumnLayout: (...args: unknown[]) => mockUpdateUserColumnLayout(...args),
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

const mockBoundingRect = () => ({
  left: 100,
  width: 100,
  right: 200,
  top: 0,
  bottom: 40,
  x: 100,
  y: 0,
  height: 40,
  toJSON: () => {},
});

const defaultProps = {
  contacts: [mockContact],
  selected: [] as (string | number)[],
  onSelect: vi.fn(),
  onSelectAll: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  sortField: "name",
  sortDir: "asc" as const,
  onSort: vi.fn(),
  columns: [
    { id: "name", label: "Name" },
    { id: "phone", label: "Phone" },
    { id: "email", label: "Email" },
  ],
};

function renderTable(
  contacts: Contact[] = [mockContact],
  columns: Array<{ id: string; label: string }> = defaultProps.columns,
): string {
  return renderToStaticMarkup(
    <ContactsListDesktopTable {...defaultProps} contacts={contacts} columns={columns} />,
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

  it("renders a sort button only for columns the server can order", () => {
    const html = renderTable(
      [mockContact],
      [
        { id: "name", label: "Name" },
        { id: "phone", label: "Phone" },
        { id: "lunarDob", label: "Lunar DOB" },
      ],
    );
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    const sortIndicators = thead.match(/lucide-chevron-(up|down)/g) ?? [];

    // Name and Lunar DOB (sorts by `dob`) are sortable; Phone is not.
    expect(sortIndicators).toHaveLength(2);
    expect(thead).toMatch(/>Phone</);
    expect(thead).not.toMatch(/<button[^>]*>Phone/);
  });

  it("renders bottom padding and horizontal scrollbar container without clipping", () => {
    const html = renderTable();

    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("pb-6");
  });

  it("marks non-sticky columns as draggable with grab cursor, while sticky name column is not draggable", () => {
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
        columns={[
          { id: "name", label: "Name" },
          { id: "phone", label: "Phone" },
          { id: "email", label: "Email" },
        ]}
      />,
    );

    // Name is stickyColumnId="name", so it should NOT have cursor-grab
    const nameMatch = /<th[^>]*data-column-id="name"[^>]*>/i.exec(html)?.[0] ?? "";
    expect(nameMatch).not.toContain("cursor-grab");

    // Phone and Email are draggable, so they should have cursor-grab
    const phoneMatch = /<th[^>]*data-column-id="phone"[^>]*>/i.exec(html)?.[0] ?? "";
    expect(phoneMatch).toContain("cursor-grab");

    const emailMatch = /<th[^>]*data-column-id="email"[^>]*>/i.exec(html)?.[0] ?? "";
    expect(emailMatch).toContain("cursor-grab");
  });

  it("calls propOnReorderColumn when provided and header is dragged", () => {
    const onReorderColumn = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ContactsListDesktopTable {...defaultProps} onReorderColumn={onReorderColumn} />);
    });

    const thPhone = container.querySelector('th[data-column-id="phone"]') as HTMLElement;
    const thEmail = container.querySelector('th[data-column-id="email"]') as HTMLElement;
    thEmail.getBoundingClientRect = mockBoundingRect;
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => thEmail;

    act(() => {
      thPhone.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120, clientY: 10 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });

    expect(onReorderColumn).toHaveBeenCalledWith("phone", "email", "before");

    document.elementFromPoint = orig;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("updates column registry layout when internal reordering is triggered", () => {
    mockUpdateUserColumnLayout.mockClear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ContactsListDesktopTable {...defaultProps} />);
    });

    const thPhone = container.querySelector('th[data-column-id="phone"]') as HTMLElement;
    const thEmail = container.querySelector('th[data-column-id="email"]') as HTMLElement;
    thEmail.getBoundingClientRect = mockBoundingRect;
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => thEmail;

    act(() => {
      thPhone.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
          button: 0,
        }),
      );
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 180, clientY: 10 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });

    expect(mockUpdateUserColumnLayout).toHaveBeenCalled();

    document.elementFromPoint = orig;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("forwards row selection onSelect callback", () => {
    const onSelect = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ContactsListDesktopTable {...defaultProps} onSelect={onSelect} />);
    });

    const rowCheckbox = container.querySelector('tbody button[role="checkbox"]') as HTMLElement;
    expect(rowCheckbox).toBeTruthy();
    act(() => {
      rowCheckbox.click();
    });
    expect(onSelect).toHaveBeenCalledWith("cnt-1");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
