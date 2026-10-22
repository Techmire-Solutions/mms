import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsPageOverlays } from "./ContactsPageOverlays";

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    formTabsReady: true,
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactsPageConfirmDialogs", () => ({
  ContactsPageConfirmDialogs: () => <div data-testid="confirm-dialogs">Dialogs</div>,
}));

vi.mock("@/tenant/features/contacts/components/ContactsImportDialog", () => ({
  ContactsImportDialog: ({ open, canWrite }: { open: boolean; canWrite: boolean }) => (
    <div data-testid="import-dialog" data-open={String(open)} data-can-write={String(canWrite)}>
      Import
    </div>
  ),
}));

vi.mock("@/tenant/features/contacts/components/ContactsCsvImportDialog", () => ({
  ContactsCsvImportDialog: ({ open, canWrite }: { open: boolean; canWrite: boolean }) => (
    <div
      data-testid="csv-import-dialog"
      data-open={String(open)}
      data-can-write={String(canWrite)}
    >
      CSV Import
    </div>
  ),
}));

const baseProps: React.ComponentProps<typeof ContactsPageOverlays> = {
  canWrite: true,
  canDelete: true,
  showForm: false,
  editContact: null,
  defaultCountry: "Pakistan",
  defaultCity: "Karachi",
  defaultProvince: "Sindh",
  onCloseForm: vi.fn(),
  onSave: vi.fn(),
  showDuplicates: false,
  onCloseDuplicates: vi.fn(),
  onMerge: vi.fn(),
  importOpen: false,
  onCloseImport: vi.fn(),
  onImportContacts: vi.fn(),
  messagingTarget: null,
  onCloseComposer: vi.fn(),
  viewContact: null,
  onCloseView: vi.fn(),
  onEditFromDrawer: vi.fn(),
  allContactsForLinks: [],
  bulkDeleteOpen: false,
  onBulkDeleteOpenChange: vi.fn(),
  selectedCount: 0,
  onConfirmBulkDelete: vi.fn(),
  deleteTarget: null,
  onDeleteTargetOpenChange: vi.fn(),
  onConfirmSingleDelete: vi.fn(),
  bulkRestoreOpen: false,
  onBulkRestoreOpenChange: vi.fn(),
  onConfirmBulkRestore: vi.fn(),
};

function render(overrides: Partial<React.ComponentProps<typeof ContactsPageOverlays>> = {}) {
  return renderToStaticMarkup(<ContactsPageOverlays {...baseProps} {...overrides} />);
}

describe("ContactsPageOverlays Component", () => {
  it("renders overlay chrome and dialogs", () => {
    const html = render();

    expect(html).toContain("confirm-dialogs");
    expect(html).toContain('data-testid="import-dialog"');
    expect(html).toContain('data-open="false"');
  });

  it("passes the open import state and write permission through to the import dialog", () => {
    const html = render({ importOpen: true, canWrite: false });

    expect(html).toContain('data-open="true"');
    expect(html).toContain('data-can-write="false"');
  });

  it("renders csv import dialog when csvImportOpen and onCloseCsvImport are provided", () => {
    const html = render({
      csvImportOpen: true,
      onCloseCsvImport: vi.fn(),
      canWrite: true,
    });

    expect(html).toContain('data-testid="csv-import-dialog"');
    expect(html).toContain('data-open="true"');
    expect(html).toContain('data-can-write="true"');
  });
});
