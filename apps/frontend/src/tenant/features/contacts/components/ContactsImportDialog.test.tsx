import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsImportDialog } from "./ContactsImportDialog";

const clearPreview = vi.fn();
const handleImport = vi.fn();
const importPanelState = {
  previewList: [] as Array<{ id: string; name: string }>,
  fileName: null as string | null,
  fileError: null as string | null,
  importing: false,
  importProgress: null as { imported: number; total: number } | null,
  result: null as { imported: number; skipped: number } | null,
  isDragging: false,
  fileRef: { current: null },
  openFilePicker: vi.fn(),
  setIsDragging: vi.fn(),
  handleDroppedFiles: vi.fn(),
  handleFile: vi.fn(),
  clearPreview,
  chooseDifferentFile: vi.fn(),
  handleImport,
};

vi.mock("@/tenant/features/contacts/hooks/useAppleContactsPanel", () => ({
  useAppleContactsPanel: () => importPanelState,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) =>
      `${key}${params?.count !== undefined ? `:${params.count}` : ""}`,
  }),
}));

vi.mock("@/components/ui/DashedFileDropZone", () => ({
  DashedFileDropZone: ({ title, inputAriaLabel }: { title: string; inputAriaLabel: string }) => (
    <div data-testid="dropzone" aria-label={inputAriaLabel}>
      {title}
    </div>
  ),
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    title,
    subtitle,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
  }) => (
    <div data-testid="modal" data-title={title} data-subtitle={subtitle}>
      {children}
    </div>
  ),
}));

function render(overrides: Partial<React.ComponentProps<typeof ContactsImportDialog>> = {}) {
  return renderToStaticMarkup(
    <ContactsImportDialog
      open={true}
      onClose={vi.fn()}
      onImport={vi.fn()}
      canWrite={true}
      {...overrides}
    />,
  );
}

describe("ContactsImportDialog", () => {
  it("renders nothing while closed or without write permission", () => {
    expect(render({ open: false })).toBe("");
    expect(render({ canWrite: false })).toBe("");
  });

  it("opens the vCard drop zone with the import title and its own file input id", () => {
    importPanelState.previewList = [];
    importPanelState.result = null;

    const html = render();

    expect(html).toContain("contacts.import");
    expect(html).toContain("contacts.sync.vcardLabel");
    expect(html).toContain("contacts.sync.uploadVcf");
    expect(html).toContain("contacts-vcf-import-dialog-file-input");
  });

  it("shows the parsed preview instead of the drop zone once a file is read", () => {
    importPanelState.previewList = [{ id: "1", name: "Ali" }];

    const html = render();

    expect(html).toContain("contacts.sync.contactsFound");
    expect(html).not.toContain('data-testid="dropzone"');
  });

  it("reports the import result and keeps the drop zone available for another file", () => {
    importPanelState.previewList = [];
    importPanelState.result = { imported: 4, skipped: 1 };

    const html = render();

    expect(html).toContain("contacts.sync.importComplete");
    expect(html).toContain('data-testid="dropzone"');
  });

  it("marks the import CTA busy while the write loop runs", () => {
    importPanelState.previewList = [{ id: "1", name: "Ali" }];
    importPanelState.result = null;
    importPanelState.importing = true;

    const html = render();

    expect(html).toContain("disabled");
    expect(html).toContain("animate-spin");
  });

  it("announces live batch progress while importing", () => {
    importPanelState.previewList = [{ id: "1", name: "Ali" }];
    importPanelState.result = null;
    importPanelState.importing = true;
    importPanelState.importProgress = { imported: 12, total: 40 };

    const html = render();

    expect(html).toContain("contacts.importProgress");
    expect(html).toContain("12");
    expect(html).toContain("40");
    expect(html).toContain('aria-live="polite"');
  });

  it("hides progress when no batch is running", () => {
    importPanelState.previewList = [{ id: "1", name: "Ali" }];
    importPanelState.result = null;
    importPanelState.importing = false;
    importPanelState.importProgress = { imported: 12, total: 40 };

    expect(render()).not.toContain("contacts.importProgress");
  });

  it("shows file error message when file cannot be parsed or has no valid contacts", () => {
    importPanelState.previewList = [];
    importPanelState.result = null;
    importPanelState.fileError = "No valid contacts found in export.csv";

    const html = render();

    expect(html).toContain("No valid contacts found in export.csv");
    expect(html).toContain('role="alert"');
  });

  it("displays selected file name in preview list", () => {
    importPanelState.previewList = [{ id: "1", name: "Ali" }];
    importPanelState.fileName = "contacts_export.csv";
    importPanelState.fileError = null;

    const html = render();

    expect(html).toContain("contacts_export.csv");
  });
});
