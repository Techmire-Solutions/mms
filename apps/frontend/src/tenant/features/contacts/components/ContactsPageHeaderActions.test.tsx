import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsPageHeaderActions } from "./ContactsPageHeaderActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function render(overrides: Partial<React.ComponentProps<typeof ContactsPageHeaderActions>> = {}) {
  return renderToStaticMarkup(
    <ContactsPageHeaderActions
      canExport={true}
      canRead={true}
      canWrite={true}
      viewingDeleted={false}
      openingDuplicates={false}
      onOpenDuplicates={vi.fn()}
      onExport={vi.fn()}
      onImport={vi.fn()}
      onAddContact={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ContactsPageHeaderActions Component", () => {
  it("renders duplicates, export, import, and add contact action buttons", () => {
    const html = render();

    expect(html).toContain("contacts.duplicates");
    expect(html).toContain("common.export");
    expect(html).toContain("contacts.import");
    expect(html).toContain("contacts.addContact");
  });

  it("hides export, import, and write CTAs while browsing trash", () => {
    const html = render({ viewingDeleted: true });

    expect(html).not.toContain("common.export");
    expect(html).not.toContain("contacts.import");
    expect(html).not.toContain("contacts.addContact");
  });

  it("hides export without the export permission", () => {
    expect(render({ canExport: false })).not.toContain("common.export");
  });

  it("hides import without write permission", () => {
    const html = render({ canWrite: false });

    expect(html).not.toContain("contacts.import");
    expect(html).not.toContain("contacts.addContact");
  });

  it("marks the export CTA busy and disabled while a server export is in flight", () => {
    const html = render({ isExporting: true });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
  });

  it("renders a dropdown trigger with menu aria when onImportCsv is provided", () => {
    const html = render({ onImportCsv: vi.fn() });

    expect(html).toContain("contacts.import");
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("renders a standard button without menu aria when onImportCsv is not provided", () => {
    const html = render({ onImportCsv: undefined });

    expect(html).toContain("contacts.import");
    expect(html).not.toContain('aria-haspopup="menu"');
  });
});
